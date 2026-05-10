import 'server-only'

import { tool } from 'ai'
import { z } from 'zod'
import type {
  BuiltMaintainerTool,
  MaintainerExposedTool,
  MaintainerTool,
  ToolErrorCode,
} from '@/tools/catalog/types'
import { createRuntimeContext } from './runtime-context'
import {
  auditErrorMessage,
  toolError as createToolError,
  toolSuccess as createToolSuccess,
  errorFromUnknown,
} from './tool-result'
import type {
  ApiPassthroughToolArgs,
  BundleChildToolArgs,
  DefineMaintainerToolArgs,
  DefineToolBundleArgs,
  ExecuteArgs,
  ExecuteResult,
  SandboxToolArgs,
  ToolPolicy,
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
  const exposedTools =
    definition.exposedTools ??
    ([
      toExposedTool({
        toolId: definition.id,
        displayName: definition.displayName,
        description: definition.description,
      }),
    ] as const)

  return {
    id: definition.id,
    category: definition.category,
    displayName: definition.displayName,
    description: definition.description,
    capabilities: definition.capabilities,
    configSchema,
    exposedTools,
    build(ctx) {
      const config = configSchema.parse(ctx.config)
      return buildChildTool({
        attachmentToolId: ctx.toolId,
        definition,
        inputSchema: definition.inputSchema,
        config,
        ctx,
        description: definition.description,
        toolId: definition.id,
      })
    },
  }
}

export const defineActionTool = defineMaintainerTool

export function defineToolBundle<TConfig = Record<string, never>>(
  definition: DefineToolBundleArgs<TConfig>
): MaintainerTool {
  const configSchema =
    definition.configSchema ??
    (emptyConfigSchema as unknown as z.ZodType<TConfig>)
  const exposedTools = Object.entries(definition.tools).map(([toolId, child]) =>
    toExposedTool({
      toolId,
      displayName: child.displayName,
      description: child.description,
    })
  )

  return {
    id: definition.id,
    category: definition.category,
    displayName: definition.displayName,
    description: definition.description,
    capabilities: definition.capabilities,
    configSchema,
    exposedTools,
    build(ctx): BuiltMaintainerTool {
      const config = configSchema.parse(ctx.config)
      return Object.fromEntries(
        Object.entries(definition.tools)
          .filter(([, child]) => child.isEnabled?.(config) ?? true)
          .map(([toolId, child]) => [
            toolId,
            buildChildTool({
              attachmentToolId: ctx.toolId,
              definition: child,
              inputSchema: child.inputSchema,
              config,
              ctx,
              description: child.description,
              toolId,
            }),
          ])
      )
    },
  }
}

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
  definition: ExecutableToolDefinition<TInput, TConfig, TData>
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

interface ExecutableToolDefinition<TInput, TConfig, TData> {
  execute(args: ExecuteArgs<TInput, TConfig>): ExecuteResult<TData>
  policies?: ToolPolicy<TInput, TConfig>[]
}

function buildChildTool<TInput, TConfig, TData>(input: {
  attachmentToolId: string
  config: TConfig
  ctx: {
    agentId: string
    conversationId: string | null
    runId: string | null
    userId: string
  }
  definition:
    | DefineMaintainerToolArgs<TInput, TConfig, TData>
    | BundleChildToolArgs<TConfig>
  description: string
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>
  toolId: string
}) {
  return tool({
    description: input.description,
    inputSchema: input.inputSchema,
    execute: async (toolInput) => {
      const runtime = createRuntimeContext({
        agentId: input.ctx.agentId,
        attachmentToolId: input.attachmentToolId,
        userId: input.ctx.userId,
        toolId: input.toolId,
        runId: input.ctx.runId,
        conversationId: input.ctx.conversationId,
        sandboxManifestId:
          'sandboxManifestId' in input.definition
            ? input.definition.sandboxManifestId
            : undefined,
      })
      return await executeWithPolicies({
        config: input.config,
        definition: input.definition as ExecutableToolDefinition<
          TInput,
          TConfig,
          TData
        >,
        input: toolInput,
        runtime,
      })
    },
  })
}

function toExposedTool(input: MaintainerExposedTool): MaintainerExposedTool {
  return input
}
