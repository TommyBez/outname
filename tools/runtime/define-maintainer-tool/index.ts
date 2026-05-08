import 'server-only'

import { tool } from 'ai'
import { z } from 'zod'
import type { MaintainerTool, ToolErrorCode } from '@/tools/catalog/types'
import { createRuntimeContext } from './runtime-context'
import {
  auditErrorMessage,
  toolError as createToolError,
  toolSuccess as createToolSuccess,
  errorFromUnknown,
} from './tool-result'
import type {
  ApiPassthroughToolArgs,
  DefineMaintainerToolArgs,
  SandboxToolArgs,
  ToolRuntimeContext as ToolRuntimeContextType,
} from './types'

export type {
  BrokeredHttpClient,
  ToolAuditSink,
  ToolSandboxRunner,
} from './runtime-context'
export type {
  PolicyResult,
  ToolPolicy,
  ToolRuntimeContext,
} from './types'

const emptyConfigSchema = z.object({})

export function toolSuccess<TData>(data: TData) {
  return createToolSuccess(data)
}

export function toolError(code: ToolErrorCode, message: string) {
  return createToolError(code, message)
}

export function defineMaintainerTool<
  TInput,
  TConfig = Record<string, never>,
  TData = unknown,
>(
  definition: DefineMaintainerToolArgs<TInput, TConfig, TData>
): MaintainerTool {
  const configSchema =
    definition.configSchema ??
    (emptyConfigSchema as unknown as z.ZodType<TConfig>)

  return {
    id: definition.id,
    category: definition.category,
    displayName: definition.displayName,
    description: definition.description,
    capabilities: definition.capabilities,
    configSchema,
    build(ctx) {
      const config = configSchema.parse(ctx.config)
      return tool({
        description: definition.description,
        inputSchema: definition.inputSchema,
        execute: async (input) => {
          const runtime = createRuntimeContext({
            agentId: ctx.agentId,
            userId: ctx.userId,
            toolId: ctx.toolId,
            runId: ctx.runId,
            conversationId: ctx.conversationId,
            sandboxManifestId: definition.sandboxManifestId,
          })
          return await executeWithPolicies({
            config,
            definition,
            input,
            runtime,
          })
        },
      })
    },
  }
}

export const defineActionTool = defineMaintainerTool

export function defineApiPassthroughTool<
  TInput,
  TConfig = Record<string, never>,
  TData = unknown,
>(args: ApiPassthroughToolArgs<TInput, TConfig, TData>): MaintainerTool {
  return defineMaintainerTool({
    ...args,
    capabilities: [{ kind: 'brokered_http', provider: args.provider }],
    async execute(input) {
      const response = await input.ctx.http.request(
        args.provider,
        args.toRequest(input)
      )
      return await args.handleResponse(response, input)
    },
  })
}

export function defineSandboxTool<
  TInput,
  TConfig = Record<string, never>,
  TData = unknown,
>(args: SandboxToolArgs<TInput, TConfig, TData>): MaintainerTool {
  return defineMaintainerTool({
    ...args,
    capabilities: [{ kind: 'tool_sandbox', manifest: args.manifestId }],
    sandboxManifestId: args.manifestId,
  })
}

async function executeWithPolicies<TInput, TConfig, TData>(input: {
  config: TConfig
  definition: DefineMaintainerToolArgs<TInput, TConfig, TData>
  input: TInput
  runtime: ToolRuntimeContextType
}) {
  const startedAt = Date.now()
  let ok = false
  let errorCode: ToolErrorCode | null = null
  let errorMessage: string | null = null
  try {
    for (const policy of input.definition.policies ?? []) {
      const result = policy({
        input: input.input,
        config: input.config,
        ctx: input.runtime,
      })
      if (!result.ok) {
        errorCode = 'policy_denied'
        errorMessage = result.message
        return createToolError('policy_denied', result.message)
      }
    }
    const result = await input.definition.execute({
      input: input.input,
      config: input.config,
      ctx: input.runtime,
    })
    ok = result.ok
    errorCode = result.ok ? null : result.code
    errorMessage = result.ok ? null : result.message
    return result
  } catch (err) {
    const result = errorFromUnknown(err)
    errorCode = result.code
    errorMessage = result.message
    return result
  } finally {
    await input.runtime.audit.record({
      ok,
      errorCode,
      errorMessage: auditErrorMessage(errorCode, errorMessage),
      durationMs: Date.now() - startedAt,
    })
  }
}
