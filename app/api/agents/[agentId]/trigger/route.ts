import { NextResponse, type NextRequest } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getGmailConnection } from "@/lib/google-oauth"
import { getAgentById, startAgentRun } from "@/lib/start-agent-run"

/**
 * Manually trigger a run for a single agent. Cron scheduling goes through
 * `/api/cron/schedule` which uses the same startAgentRun helper.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { agentId } = await params
  const agent = await getAgentById(agentId)
  if (!agent || agent.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  // daily-email-brief is the only kind today and it requires Gmail.
  if (agent.kind === "daily-email-brief") {
    const conn = await getGmailConnection()
    if (!conn) {
      return NextResponse.json(
        {
          error:
            "Gmail is not connected. Go to /settings and click Connect Gmail.",
        },
        { status: 412 },
      )
    }
    if (conn.status !== "active") {
      return NextResponse.json(
        {
          error: `Gmail connection is ${conn.status}. Reconnect it in /settings.`,
        },
        { status: 412 },
      )
    }
  }

  try {
    const { runId, workflowRunId } = await startAgentRun({
      agent,
      trigger: "manual",
      scheduledFor: null, // manual = run immediately
    })
    return NextResponse.json({ runId, workflowRunId })
  } catch {
    return NextResponse.json(
      { error: "failed to start workflow" },
      { status: 500 },
    )
  }
}
