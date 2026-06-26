import { withRedisLock } from '@outname/ai/agent-runtime/server/redis-lock'
import {
  DEFAULT_CRON_SNAPSHOT_CLEANUP_OLDER_THAN_DAYS,
  summarizeVercelSandboxSnapshotCleanup,
  sweepUnusedVercelSandboxSnapshots,
} from '@outname/shared/server/vercel-sandbox-snapshot-cleanup'
import { connection, type NextRequest, NextResponse } from 'next/server'

const LOCK_TTL_SECONDS = 55 * 60

export async function GET(req: NextRequest) {
  await connection()

  const expected = process.env.CRON_SECRET

  if (!expected) {
    return NextResponse.json({ error: 'cron secret not set' }, { status: 500 })
  }

  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (process.env.SANDBOX_SNAPSHOT_CLEANUP_CRON_ENABLED === 'false') {
    return NextResponse.json({
      ok: true,
      skipped: 'sandbox snapshot cleanup cron disabled',
    })
  }

  const olderThanDays = readCronOlderThanDaysResponse()
  if (!olderThanDays.ok) {
    return NextResponse.json({ error: olderThanDays.error }, { status: 500 })
  }

  const result = await withRedisLock(
    'vercel-sandbox-snapshots:cleanup',
    LOCK_TTL_SECONDS,
    async () =>
      await sweepUnusedVercelSandboxSnapshots({
        execute: true,
        olderThanDays: olderThanDays.value,
      })
  )

  if (!result) {
    return NextResponse.json({
      ok: true,
      skipped: 'sandbox snapshot cleanup already running',
    })
  }

  const summary = summarizeVercelSandboxSnapshotCleanup(result)
  return NextResponse.json(
    {
      ok: summary.failureCount === 0,
      ...summary,
      olderThanDays: olderThanDays.value,
    },
    { status: summary.failureCount === 0 ? 200 : 500 }
  )
}

function readCronOlderThanDaysResponse():
  | { ok: true; value: number | null }
  | { error: string; ok: false } {
  try {
    return { ok: true, value: readCronOlderThanDays() }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'invalid configuration',
      ok: false,
    }
  }
}

function readCronOlderThanDays(): number | null {
  const value = process.env.SANDBOX_SNAPSHOT_CLEANUP_OLDER_THAN_DAYS?.trim()
  if (!value) {
    return DEFAULT_CRON_SNAPSHOT_CLEANUP_OLDER_THAN_DAYS
  }

  if (value === '0') {
    return null
  }

  const parsedValue = Number(value)
  if (!(Number.isInteger(parsedValue) && parsedValue > 0)) {
    throw new Error(
      'SANDBOX_SNAPSHOT_CLEANUP_OLDER_THAN_DAYS must be a positive integer, or 0 to delete every unused snapshot.'
    )
  }

  return parsedValue
}
