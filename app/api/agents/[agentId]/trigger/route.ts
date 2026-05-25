import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import {
  pokeDreaming,
  pokeHeartbeat,
} from '@/agent-runtime/server/session-events'
import { getAgentById } from '@/agent-runtime/server/start-agent-run'
import { auth } from '@/auth/server/auth'
import { db } from '@/shared/db/pool'
import { user } from '@/shared/db/schema'
import { localDateKey } from '@/shared/server/timezone'

type TriggerMode = 'heartbeat' | 'dreaming'

// Manual triggers enqueue the same event shape the scheduler creates.
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
    const { eventId, sessionRunId } =
      mode === 'dreaming'
        ? await pokeDreaming({
            agent,
            localDate: await readUserLocalDate(session.user.id),
          })
        : await pokeHeartbeat({ agent })

    revalidatePath(`/agents/${agent.id}`)
    revalidatePath(`/agents/${agent.id}/memory/timeline`)
    revalidatePath(`/agents/${agent.id}/memory/dreams`)
    revalidatePath(`/agents/${agent.id}/timeline`)
    revalidatePath(`/agents/${agent.id}/dreams`)
    revalidatePath('/agents')
    revalidatePath('/')

    return NextResponse.json({
      eventId,
      ok: true,
      mode,
      workflowRunId: sessionRunId,
    })
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
  return body && body.mode === 'dreaming' ? 'dreaming' : 'heartbeat'
}

async function readUserLocalDate(userId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: user.timezone })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return localDateKey(new Date(), row?.timezone)
}
