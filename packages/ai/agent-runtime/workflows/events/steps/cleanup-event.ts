import { withVercelSandboxCredentials } from '@outname/shared/server/vercel-sandbox-config'
import { Sandbox } from '@vercel/sandbox'

const VERCEL_SANDBOX_PAGE_LIMIT = 50
const VERCEL_SANDBOX_REQUEST_TIMEOUT_MS = 5000
const TAGGED_EPHEMERAL_SANDBOX_KINDS = new Set([
  'brokered-http',
  'repo-workspace',
  'tool-runtime',
])

type ListedSandbox = Awaited<
  ReturnType<typeof Sandbox.list>
>['sandboxes'][number]

export async function cleanupEventResources(input: {
  agentId: string
  runId: string
}): Promise<void> {
  'use step'
  const [
    { stopAllToolSandboxesForRun },
    { stopAllBrokeredHttpSandboxesForRun },
    { stopAllRepoWorkspacesForRun },
    { refreshAgentFileCache },
  ] = await Promise.all([
    import('@outname/ai/tools/sandbox-runtime/runtime'),
    import('@outname/ai/tools/runtime/brokered-http/sandbox'),
    import('@outname/ai/tools/runtime/repo-workspace/sandbox'),
    import('@outname/ai/agent-runtime/server/file-cache'),
  ])

  await Promise.all([
    bestEffortCleanup('stopAllToolSandboxesForRun', stopAllToolSandboxesForRun),
    bestEffortCleanup(
      'stopAllBrokeredHttpSandboxesForRun',
      stopAllBrokeredHttpSandboxesForRun
    ),
    bestEffortCleanup(
      'stopAllRepoWorkspacesForRun',
      stopAllRepoWorkspacesForRun
    ),
    bestEffortCleanup('tagged sandbox cleanup', () =>
      cleanupTaggedEphemeralSandboxesForRun(input.runId)
    ),
    bestEffortCleanup('refreshAgentFileCache', () =>
      refreshAgentFileCache(input.agentId)
    ),
  ])
}

async function bestEffortCleanup(
  label: string,
  cleanup: () => Promise<unknown>
): Promise<void> {
  try {
    await cleanup()
  } catch (err) {
    console.error(`[events] ${label} failed`, err)
  }
}

async function cleanupTaggedEphemeralSandboxesForRun(
  runId: string
): Promise<void> {
  const sandboxes = await listProjectSandboxes()
  const targets = sandboxes.filter((sandbox) =>
    shouldDeleteTaggedEphemeralSandbox({ runId, sandbox })
  )

  await Promise.all(
    targets.map(async (sandbox) => {
      try {
        await deleteListedSandbox(sandbox)
      } catch (err) {
        console.error('[events] tagged sandbox delete failed', {
          err,
          name: sandbox.name,
          runId,
        })
      }
    })
  )
}

async function listProjectSandboxes(): Promise<ListedSandbox[]> {
  const sandboxes: ListedSandbox[] = []
  let cursor = ''
  const seenCursors = new Set<string>()

  do {
    if (cursor) {
      if (seenCursors.has(cursor)) {
        throw new Error(`Repeated sandbox pagination cursor: ${cursor}`)
      }
      seenCursors.add(cursor)
    }

    const response = await Sandbox.list(
      withVercelSandboxCredentials({
        cursor: cursor || undefined,
        limit: VERCEL_SANDBOX_PAGE_LIMIT,
        signal: AbortSignal.timeout(VERCEL_SANDBOX_REQUEST_TIMEOUT_MS),
      })
    )
    sandboxes.push(...response.sandboxes)
    cursor = response.pagination.next ?? ''
  } while (cursor)

  return sandboxes
}

function shouldDeleteTaggedEphemeralSandbox(input: {
  runId: string
  sandbox: ListedSandbox
}): boolean {
  const kind = input.sandbox.tags?.kind
  return (
    !input.sandbox.persistent &&
    input.sandbox.tags?.runId === input.runId &&
    kind !== undefined &&
    TAGGED_EPHEMERAL_SANDBOX_KINDS.has(kind)
  )
}

async function deleteListedSandbox(sandbox: ListedSandbox): Promise<void> {
  const handle = await Sandbox.get(
    withVercelSandboxCredentials({
      name: sandbox.name,
      resume: false,
      signal: AbortSignal.timeout(VERCEL_SANDBOX_REQUEST_TIMEOUT_MS),
    })
  )
  await handle.delete()
}
