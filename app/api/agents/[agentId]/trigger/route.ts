import { revalidatePath, revalidateTag } from 'next/cache'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { pokeHeartbeat } from '@/lib/agent-session'
import { auth } from '@/lib/auth'
import { agentRunsTag, runsIndexTag } from '@/lib/cache-tags'
import { getAgentById } from '@/lib/start-agent-run'

/**
 * Manually trigger an out-of-band heartbeat for a single agent.
 *
 * In the agent-session model the agent is *always* running while it is
 * enabled — the workflow is suspended on a `for await (event of hook)`
 * loop and the cron ticker delivers a `{type:"heartbeat"}` event every
 * 30 minutes. This route simply pokes that same hook so the user can
 * force a run without waiting for the next tick.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { agentId } = await params
  const agent = await getAgentById(agentId)
  if (!agent || agent.userId !== session.user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  if (!agent.enabled) {
    return NextResponse.json(
      { error: 'Agent is paused. Enable it before triggering a run.' },
      { status: 412 }
    )
  }

  try {
    const { sessionRunId } = await pokeHeartbeat({ agent })

    revalidateTag(agentRunsTag(agent.id), 'max')
    revalidateTag(runsIndexTag(), 'max')
    revalidatePath(`/agents/${agent.id}`)
    revalidatePath('/agents')
    revalidatePath('/runs')
    revalidatePath('/')

    return NextResponse.json({ ok: true, sessionRunId })
  } catch (err) {
    console.error('[trigger] failed', err)
    return NextResponse.json(
      { error: 'failed to poke heartbeat' },
      { status: 500 }
    )
  }
}
