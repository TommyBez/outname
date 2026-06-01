import { runAgentEventScheduler } from '@outname/ai/agent-runtime/server/event-scheduler'
import { withRedisLock } from '@outname/ai/agent-runtime/server/redis-lock'
import { connection, type NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  await connection()

  const expected = process.env.CRON_SECRET
  if (expected && req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (process.env.AGENT_SCHEDULER_CRON_ENABLED === 'false') {
    return NextResponse.json({ ok: true, skipped: 'scheduler cron disabled' })
  }

  const result = await withRedisLock(
    'agent-events:scheduler:liveness',
    240,
    async () => await runAgentEventScheduler()
  )

  if (!result) {
    return NextResponse.json({ ok: true, skipped: 'scheduler already running' })
  }

  return NextResponse.json({ ok: true, ...result })
}
