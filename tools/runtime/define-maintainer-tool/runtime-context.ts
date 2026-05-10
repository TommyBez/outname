import type { ToolErrorCode } from '@/tools/catalog/types'
import type {
  BrokeredHttpRequest,
  BrokeredHttpResponse,
} from '../brokered-http/types'

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
    timeoutMs?: number
  }): Promise<{
    exitCode: number
    stderr: string
    stdout: string
    timedOut?: true
  }>
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

export function createRuntimeContext(input: {
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
        const { brokeredHttpRequest } = await import('../brokered-http')
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
        const { runToolSandboxCommand } = await import('../tool-sandbox-runner')
        return await runToolSandboxCommand({
          manifestId,
          userId,
          cmd: args.cmd,
          args: args.args,
          stdoutLimit: args.stdoutLimit ?? 64 * 1024,
          stderrLimit: args.stderrLimit ?? 8 * 1024,
          timeoutMs: args.timeoutMs,
        })
      },
    },
    audit: {
      async record(record) {
        const { recordToolInvocation } = await import('../audit')
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
