import { eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { pokeHeartbeat, pokeReflection } from '@/lib/agent-session'
import { auth } from '@/lib/auth'
import { agentRunsTag, runsIndexTag } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { getAgentById } from '@/lib/start-agent-run'
import { localDateKey } from '@/lib/timezone'

type TriggerMode = 'heartbeat' | 'reflection'

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
  req: NextRequest,
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
    const mode = await readTriggerMode(req)
    const { sessionRunId } =
      mode === 'reflection'
        ? await pokeReflection({
            agent,
            localDate: await readUserLocalDate(session.user.id),
          })
        : await pokeHeartbeat({ agent })

    revalidateTag(agentRunsTag(agent.id), 'max')
    revalidateTag(runsIndexTag(), 'max')
    revalidatePath(`/agents/${agent.id}`)
    revalidatePath(`/agents/${agent.id}/timeline`)
    revalidatePath(`/agents/${agent.id}/dreams`)
    revalidatePath('/agents')
    revalidatePath('/')

    return NextResponse.json({ ok: true, mode, sessionRunId })
  } catch (err) {
    console.error('[trigger] failed', err)
    return NextResponse.json(
      { error: 'failed to poke heartbeat' },
      { status: 500 }
    )
  }
}

async function readTriggerMode(req: NextRequest): Promise<TriggerMode> {
  const body = await req.json().catch(() => null)
  return body && body.mode === 'reflection' ? 'reflection' : 'heartbeat'
}

async function readUserLocalDate(userId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: user.timezone })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return localDateKey(new Date(), row?.timezone)
}
