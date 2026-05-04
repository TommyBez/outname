import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import type { BrokeredHttpRequest, BrokeredHttpResponse } from './brokered-http'
import type {
  MaintainerTool,
  ToolBuildContext,
  ToolCapability,
  ToolErrorCode,
  ToolResult,
} from './types'

export interface BrokeredHttpClient {
  request(
    provider: string,
    request: BrokeredHttpRequest
  ): Promise<BrokeredHttpResponse>
}

export interface ToolSandboxRunner {
  run(input: {
    args: string[]
    cmd: string
    manifestId: string
    stderrLimit?: number
    stdoutLimit?: number
  }): Promise<{ exitCode: number; stderr: string; stdout: string }>
}

export interface ToolAuditSink {
  record(input: {
    durationMs: number
    errorCode: ToolErrorCode | null
    ok: boolean
  }): Promise<void>
}

export interface ToolRuntimeContext {
  agentId: string
  audit: ToolAuditSink
  http: BrokeredHttpClient
  sandbox: ToolSandboxRunner
  toolId: string
}

export type PolicyResult = { ok: true } | { ok: false; message: string }

export type ToolPolicy<TInput, TConfig> = (input: {
  config: TConfig
  ctx: ToolRuntimeContext
  input: TInput
}) => PolicyResult

interface ExecuteArgs<TInput, TConfig> {
  config: TConfig
  ctx: ToolRuntimeContext
  input: TInput
}

type ExecuteResult<TData> = Promise<TData | ToolResult<TData>>

interface DefineMaintainerToolArgs<TInput, TConfig, TData> {
  capabilities: ToolCapability[]
  category: string
  configSchema?: z.ZodType<TConfig, z.ZodTypeDef, unknown>
  description: string
  displayName: string
  execute(args: ExecuteArgs<TInput, TConfig>): ExecuteResult<TData>
  id: string
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>
  policies?: ToolPolicy<TInput, TConfig>[]
}

const emptyConfigSchema = z.object({})

function isToolResult<TData>(value: unknown): value is ToolResult<TData> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    typeof (value as { ok?: unknown }).ok === 'boolean'
  )
}

export function toolSuccess<TData>(data: TData): ToolResult<TData> {
  return { ok: true, data }
}

export function toolError(
  code: ToolErrorCode,
  message: string
): ToolResult<never> {
  return { ok: false, code, message }
}

function errorFromUnknown(err: unknown): ToolResult<never> {
  if (err instanceof Error) {
    return toolError('internal_error', err.message)
  }
  return toolError('internal_error', String(err))
}

function createRuntimeContext(input: {
  agentId: string
  toolId: string
  userId: string
}): ToolRuntimeContext {
  const { agentId, toolId, userId } = input
  return {
    agentId,
    toolId,
    http: {
      async request(provider, request) {
        const { brokeredHttpRequest } = await import('./brokered-http')
        return await brokeredHttpRequest({
          agentId,
          toolId,
          userId,
          provider,
          request,
        })
      },
    },
    sandbox: {
      async run(args) {
        const { runToolSandboxCommand } = await import('./tool-sandbox-runner')
        return await runToolSandboxCommand({
          manifestId: args.manifestId,
          cmd: args.cmd,
          args: args.args,
          stdoutLimit: args.stdoutLimit ?? 64 * 1024,
          stderrLimit: args.stderrLimit ?? 8 * 1024,
        })
      },
    },
    audit: {
      async record(record) {
        const { recordToolInvocation } = await import('./audit')
        await recordToolInvocation({
          agentId,
          toolId,
          kind: 'maintainer',
          ok: record.ok,
          durationMs: record.durationMs,
          errorCode: record.errorCode,
        })
      },
    },
  }
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
    build(ctx: ToolBuildContext) {
      const config = configSchema.parse(ctx.config)
      return tool({
        description: definition.description,
        inputSchema: definition.inputSchema,
        execute: async (input) => {
          const runtime = createRuntimeContext({
            agentId: ctx.agentId,
            userId: ctx.userId,
            toolId: ctx.toolId,
          })
          const startedAt = Date.now()
          let ok = false
          let errorCode: ToolErrorCode | null = null
          try {
            for (const policy of definition.policies ?? []) {
              const result = policy({ input, config, ctx: runtime })
              if (!result.ok) {
                errorCode = 'policy_denied'
                return toolError('policy_denied', result.message)
              }
            }
            const value = await definition.execute({
              input,
              config,
              ctx: runtime,
            })
            const result = isToolResult<TData>(value)
              ? value
              : toolSuccess(value)
            ok = result.ok
            errorCode = result.ok ? null : result.code
            return result
          } catch (err) {
            const result = errorFromUnknown(err)
            errorCode = 'internal_error'
            return result
          } finally {
            await runtime.audit.record({
              ok,
              errorCode,
              durationMs: Date.now() - startedAt,
            })
          }
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
>(
  args: Omit<
    DefineMaintainerToolArgs<TInput, TConfig, TData>,
    'capabilities' | 'execute'
  > & {
    handleResponse(
      response: BrokeredHttpResponse,
      input: ExecuteArgs<TInput, TConfig>
    ): Promise<TData | ToolResult<TData>> | TData | ToolResult<TData>
    provider: string
    toRequest(input: ExecuteArgs<TInput, TConfig>): BrokeredHttpRequest
  }
): MaintainerTool {
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
>(
  args: Omit<
    DefineMaintainerToolArgs<TInput, TConfig, TData>,
    'capabilities'
  > & {
    manifestId: string
  }
): MaintainerTool {
  return defineMaintainerTool({
    ...args,
    capabilities: [{ kind: 'tool_sandbox', manifest: args.manifestId }],
  })
}
