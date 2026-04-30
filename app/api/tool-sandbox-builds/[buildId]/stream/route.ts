import { and, eq } from 'drizzle-orm'
import { getRun } from 'workflow/api'
import { getSession } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { agent, agentTools, toolSandboxBuilds } from '@/lib/db/schema'
import {
  buildToolSandboxNamespace,
  type ToolSandboxBuildEvent,
} from '@/workflows/build-tool-sandbox/events'

/**
 * Phase 4: stream tool-sandbox build progress events as NDJSON.
 *
 * Modeled on `/api/runs/[runId]/stream` — the build workflow writes to
 * a per-build namespace; this route relays it to the client. We open
 * the readable with `startIndex: 0` so a re-mount or refresh replays
 * every progress event the workflow has emitted, which is what makes
 * persisting messages to the DB unnecessary.
 *
 * Auth: the build itself is global (one snapshot serves every user),
 * so the gate is "user is signed in AND has at least one `agent_tools`
 * row referencing the build's manifest". This avoids leaking other
 * users' build ids without making builds private (which would defeat
 * coalescing).
 */
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

  // Owner check: this user must have at least one agent_tools row
  // referencing this manifest. Single inner join keeps it cheap and
  // means we never reveal another user's pending build to anyone but
  // people actively waiting on the same snapshot.
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
  maxMs = 5_000
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
