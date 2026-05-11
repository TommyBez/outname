import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import {
  type RecoveryMode,
  recoverAgentSession,
} from '@/agent-runtime/server/session-recovery'
import { getAgentById } from '@/agent-runtime/server/start-agent-run'
import { auth } from '@/auth/server/auth'

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
      { error: 'Agent is paused. Enable it before recovering the session.' },
      { status: 412 }
    )
  }

  const mode = await readRecoveryMode(req)
  const result = await recoverAgentSession({
    agentId: agent.id,
    mode,
    reason: 'manual_recovery',
  })

  if (!result.recovered) {
    return NextResponse.json(
      { error: recoveryErrorMessage(result.reason), result },
      { status: recoveryStatus(result.reason) }
    )
  }

  revalidatePath(`/agents/${agent.id}`)
  revalidatePath(`/agents/${agent.id}/memory/timeline`)
  revalidatePath(`/agents/${agent.id}/memory/dreams`)
  revalidatePath(`/agents/${agent.id}/timeline`)
  revalidatePath(`/agents/${agent.id}/dreams`)
  revalidatePath('/agents')
  revalidatePath('/')

  return NextResponse.json({ ok: true, result })
}

async function readRecoveryMode(req: NextRequest): Promise<RecoveryMode> {
  const body = await req.json().catch(() => null)
  return body && body.mode === 'force' ? 'force' : 'safe'
}

function recoveryStatus(reason: string): number {
  switch (reason) {
    case 'agent_disabled':
      return 412
    case 'recovery_already_in_progress':
    case 'session_cancel_timeout':
      return 409
    default:
      return 500
  }
}

function recoveryErrorMessage(reason: string): string {
  switch (reason) {
    case 'recovery_already_in_progress':
      return 'Recovery already running.'
    case 'session_cancel_timeout':
      return 'Safe recovery timed out. Try force recovery.'
    case 'agent_disabled':
      return 'Agent is paused. Enable it before recovering the session.'
    default:
      return 'Recovery failed.'
  }
}
