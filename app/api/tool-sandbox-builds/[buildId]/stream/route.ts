import { and, eq } from 'drizzle-orm'
import { getRun } from 'workflow/api'
import { getSession } from '@/auth/server/auth-guard'
import { db } from '@/shared/db/pool'
import { agent, agentTools, toolSandboxBuilds } from '@/shared/db/schema'
import {
  buildToolSandboxNamespace,
  type ToolSandboxBuildEvent,
} from '@/tools/sandbox-runtime/workflow/events'

// Replay from `startIndex: 0` so reconnects see the full build event stream.
// Auth gates on manifest ownership because the build snapshot itself is shared.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ buildId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return jsonError(401, 'unauthorized')
  }

  const { buildId } = await params
  const [build] = await db
    .select()
    .from(toolSandboxBuilds)
    .where(eq(toolSandboxBuilds.id, buildId))
    .limit(1)
  if (!build) {
    return new Response('not found', { status: 404 })
  }

  // Only users already referencing this manifest may watch the shared build stream.
  const [ownerRow] = await db
    .select({ agentId: agentTools.agentId })
    .from(agentTools)
    .innerJoin(agent, eq(agent.id, agentTools.agentId))
    .where(
      and(
        eq(agentTools.toolSandboxManifest, build.manifestId),
        eq(agent.userId, session.user.id)
      )
    )
    .limit(1)
  if (!ownerRow) {
    return jsonError(403, 'forbidden')
  }

  const workflowRunId =
    build.workflowRunId ?? (await waitForWorkflowRunId(buildId))
  if (!workflowRunId) {
    return jsonError(409, 'workflow not started')
  }

  const run = getRun(workflowRunId)
  try {
    await run.status
  } catch (err) {
    if (!(err instanceof Error && err.name === 'WorkflowRunNotFoundError')) {
      throw err
    }
    return jsonError(409, 'workflow unavailable in this environment', {
      workflowRunId,
    })
  }

  const source = run.getReadable<ToolSandboxBuildEvent>({
    namespace: buildToolSandboxNamespace(buildId),
    startIndex: 0,
  })

  const encoder = new TextEncoder()
  const body = source.pipeThrough(
    new TransformStream<ToolSandboxBuildEvent, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`))
      },
    })
  )

  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}

function jsonError(status: number, error: string, extra?: object): Response {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function waitForWorkflowRunId(
  buildId: string,
  maxMs = 5000
): Promise<string | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const [r] = await db
      .select({
        workflowRunId: toolSandboxBuilds.workflowRunId,
        status: toolSandboxBuilds.status,
      })
      .from(toolSandboxBuilds)
      .where(eq(toolSandboxBuilds.id, buildId))
      .limit(1)
    if (!r) {
      return null
    }
    if (r.workflowRunId) {
      return r.workflowRunId
    }
    if (r.status === 'ready' || r.status === 'failed') {
      return null
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return null
}
