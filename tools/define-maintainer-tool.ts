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
    manifestId?: string
    stderrLimit?: number
    stdoutLimit?: number
  }): Promise<{ exitCode: number; stderr: string; stdout: string }>
}

export interface ToolAuditSink {
  record(input: {
    durationMs: number
    errorCode: ToolErrorCode | null
    errorMessage: string | null
    ok: boolean
  }): Promise<void>
}

export interface ToolRuntimeContext {
  agentId: string
  audit: ToolAuditSink
  conversationId: string | null
  http: BrokeredHttpClient
  runId: string | null
  sandbox: ToolSandboxRunner
  toolId: string
  userId: string
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

type ExecuteResult<TData> = Promise<ToolResult<TData>> | ToolResult<TData>
type ToolFailure = Extract<ToolResult<never>, { ok: false }>

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
  sandboxManifestId?: string
}

const emptyConfigSchema = z.object({})

export function toolSuccess<TData>(data: TData): ToolResult<TData> {
  return { ok: true, data }
}

export function toolError(code: ToolErrorCode, message: string): ToolFailure {
  return { ok: false, code, message }
}

const toolErrorCodes = new Set<ToolErrorCode>([
  'invalid_input',
  'policy_denied',
  'provider_error',
  'rate_limited',
  'unavailable',
  'internal_error',
])
const httpStatusPattern = /HTTP \d{3}/

function codeFromUnknown(err: unknown): ToolErrorCode {
  if (typeof err !== 'object' || err === null || !('code' in err)) {
    return 'internal_error'
  }
  const code = (err as { code?: unknown }).code
  if (code === 'connection_unavailable') {
    return 'unavailable'
  }
  if (typeof code === 'string' && toolErrorCodes.has(code as ToolErrorCode)) {
    return code as ToolErrorCode
  }
  return 'internal_error'
}

function errorFromUnknown(err: unknown): ToolFailure {
  const code = codeFromUnknown(err)
  if (err instanceof Error) {
    return toolError(code, err.message)
  }
  return toolError(code, String(err))
}

function auditErrorMessage(
  code: ToolErrorCode | null,
  message: string | null
): string | null {
  if (!(code && message)) {
    return null
  }
  if (code === 'provider_error') {
    return message.match(httpStatusPattern)?.[0] ?? 'Provider error'
  }
  return message
}

function createRuntimeContext(input: {
  agentId: string
  conversationId: string | null
  runId: string | null
  sandboxManifestId?: string
  toolId: string
  userId: string
}): ToolRuntimeContext {
  const { agentId, conversationId, runId, sandboxManifestId, toolId, userId } =
    input
  return {
    agentId,
    conversationId,
    runId,
    toolId,
    userId,
    http: {
      async request(provider, request) {
        // Keep these imports lazy so maintainer-tool definitions stay
        // workflow-bundle clean. The imported modules carry DB,
        // crypto, and Sandbox SDK edges that belong only inside
        // `'use step'` execution.
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
        const manifestId = args.manifestId ?? sandboxManifestId
        if (!manifestId) {
          throw new Error('No tool sandbox manifest is bound for this tool.')
        }
        const { runToolSandboxCommand } = await import('./tool-sandbox-runner')
        return await runToolSandboxCommand({
          manifestId,
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
          errorMessage: record.errorMessage,
          runId,
          conversationId,
          userId,
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
            runId: ctx.runId,
            conversationId: ctx.conversationId,
            sandboxManifestId: definition.sandboxManifestId,
          })
          const startedAt = Date.now()
          let ok = false
          let errorCode: ToolErrorCode | null = null
          let errorMessage: string | null = null
          try {
            for (const policy of definition.policies ?? []) {
              const result = policy({ input, config, ctx: runtime })
              if (!result.ok) {
                errorCode = 'policy_denied'
                errorMessage = result.message
                return toolError('policy_denied', result.message)
              }
            }
            const result = await definition.execute({
              input,
              config,
              ctx: runtime,
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
            await runtime.audit.record({
              ok,
              errorCode,
              errorMessage: auditErrorMessage(errorCode, errorMessage),
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
    ): Promise<ToolResult<TData>> | ToolResult<TData>
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
    sandboxManifestId: args.manifestId,
  })
}
