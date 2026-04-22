import { NextResponse, type NextRequest } from "next/server"
import { headers } from "next/headers"
import { revalidatePath, revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { agentRunsTag, runTag, runsIndexTag } from "@/lib/cache-tags"
import { getGmailConnectionForUser } from "@/lib/google-oauth"
import { getAgentById, startAgentRun } from "@/lib/start-agent-run"

/**
 * Manually trigger a run for a single agent.
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
    const conn = await getGmailConnectionForUser(agent.userId)
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
    const { runId, workflowRunId } = await startAgentRun({ agent })

    revalidateTag(agentRunsTag(agent.id), "max")
    revalidateTag(runTag(runId), "max")
    revalidateTag(runsIndexTag(), "max")
    revalidatePath(`/agents/${agent.id}`)
    revalidatePath("/agents")
    revalidatePath("/runs")
    revalidatePath("/")

    return NextResponse.json({ runId, workflowRunId })
  } catch {
    return NextResponse.json(
      { error: "failed to start workflow" },
      { status: 500 },
    )
  }
}
