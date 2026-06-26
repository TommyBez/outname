import { afterEach, describe, expect, it } from 'vitest'
import { PERSISTENT_SANDBOX_RETENTION_OPTIONS } from './vercel-sandbox-config'
import {
  type SandboxRecord,
  type SandboxSnapshotCleanupClient,
  type SnapshotRecord,
  sweepUnusedVercelSandboxSnapshots,
} from './vercel-sandbox-snapshot-cleanup'

const CREDENTIAL_ENV_KEYS = [
  'SANDBOX_TEAM_ID',
  'SANDBOX_PROJECT_ID',
  'SANDBOX_ACCESS_TOKEN',
] as const
const NOW = Date.UTC(2026, 5, 26)
const TWO_DAYS_AGO = NOW - 2 * 24 * 60 * 60_000
const ONE_HOUR_AGO = NOW - 60 * 60_000

const originalEnv = Object.fromEntries(
  CREDENTIAL_ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<(typeof CREDENTIAL_ENV_KEYS)[number], string | undefined>

afterEach(() => {
  restoreEnv()
})

describe('sweepUnusedVercelSandboxSnapshots', () => {
  it('plans old non-current created snapshots on persistent sandboxes', async () => {
    setSandboxCredentialEnv()

    const listedSnapshotSandboxNames: string[] = []
    const client = createFakeClient({
      listedSnapshotSandboxNames,
      sandboxes: [
        persistentSandbox({
          currentSnapshotId: 'snap-current',
          name: 'sandbox-a',
        }),
        {
          currentSnapshotId: 'ephemeral-current',
          keepLastSnapshots:
            PERSISTENT_SANDBOX_RETENTION_OPTIONS.keepLastSnapshots,
          name: 'ephemeral-a',
          persistent: false,
          snapshotExpiration:
            PERSISTENT_SANDBOX_RETENTION_OPTIONS.snapshotExpiration,
          status: 'running',
        },
      ],
      snapshotsBySandbox: {
        'sandbox-a': [
          createdSnapshot({
            createdAt: TWO_DAYS_AGO,
            id: 'snap-current',
            sizeBytes: 1000,
          }),
          createdSnapshot({
            createdAt: TWO_DAYS_AGO,
            id: 'snap-unused-old',
            sizeBytes: 3000,
          }),
          createdSnapshot({
            createdAt: ONE_HOUR_AGO,
            id: 'snap-unused-new',
            sizeBytes: 5000,
          }),
          {
            createdAt: TWO_DAYS_AGO,
            id: 'snap-building',
            sizeBytes: 7000,
            status: 'creating',
          },
        ],
      },
    })

    const result = await sweepUnusedVercelSandboxSnapshots({
      client,
      execute: false,
      now: NOW,
      olderThanDays: 1,
    })

    expect(listedSnapshotSandboxNames).toEqual(['sandbox-a'])
    expect(result.executed).toBe(false)
    expect(
      result.plan.candidates.map((candidate) => candidate.snapshot.id)
    ).toEqual(['snap-unused-old'])
    expect(result.plan.candidateBytes).toBe(3000)
    expect(result.plan.createdSnapshotCount).toBe(3)
    expect(result.plan.retentionUpdateCount).toBe(0)
  })

  it('updates stale retention and reports delete failures without stopping', async () => {
    setSandboxCredentialEnv()

    const deletedSnapshotIds: string[] = []
    const retentionSandboxNames: string[] = []
    const client = createFakeClient({
      deletedSnapshotIds,
      failedDeleteSnapshotIds: new Set(['snap-delete-fails']),
      retentionSandboxNames,
      sandboxes: [
        persistentSandbox({
          keepLastSnapshots: { count: 2, deleteEvicted: false },
          name: 'sandbox-a',
          snapshotExpiration: 30_000,
        }),
      ],
      snapshotsBySandbox: {
        'sandbox-a': [
          createdSnapshot({
            createdAt: TWO_DAYS_AGO,
            id: 'snap-delete-ok',
            sizeBytes: 1000,
          }),
          createdSnapshot({
            createdAt: TWO_DAYS_AGO,
            id: 'snap-delete-fails',
            sizeBytes: 2000,
          }),
        ],
      },
    })

    const result = await sweepUnusedVercelSandboxSnapshots({
      client,
      execute: true,
      now: NOW,
      olderThanDays: 1,
    })

    expect(retentionSandboxNames).toEqual(['sandbox-a'])
    expect(deletedSnapshotIds).toEqual(['snap-delete-fails', 'snap-delete-ok'])
    expect(result.deletedSnapshotCount).toBe(1)
    expect(result.updatedRetentionCount).toBe(1)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]?.target).toBe('sandbox-a: snap-delete-fails')
  })
})

function restoreEnv(): void {
  for (const key of CREDENTIAL_ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function setSandboxCredentialEnv(): void {
  process.env.SANDBOX_TEAM_ID = 'team_123'
  process.env.SANDBOX_PROJECT_ID = 'prj_123'
  process.env.SANDBOX_ACCESS_TOKEN = 'token_123'
}

function persistentSandbox(input: {
  currentSnapshotId?: string
  keepLastSnapshots?: SandboxRecord['keepLastSnapshots']
  name: string
  snapshotExpiration?: number
}): SandboxRecord {
  return {
    currentSnapshotId: input.currentSnapshotId,
    keepLastSnapshots:
      input.keepLastSnapshots ??
      PERSISTENT_SANDBOX_RETENTION_OPTIONS.keepLastSnapshots,
    name: input.name,
    persistent: true,
    snapshotExpiration:
      input.snapshotExpiration ??
      PERSISTENT_SANDBOX_RETENTION_OPTIONS.snapshotExpiration,
    status: 'running',
  }
}

function createdSnapshot(input: {
  createdAt: number
  id: string
  sizeBytes: number
}): SnapshotRecord {
  return {
    createdAt: input.createdAt,
    id: input.id,
    sizeBytes: input.sizeBytes,
    status: 'created',
  }
}

function createFakeClient(input: {
  deletedSnapshotIds?: string[]
  failedDeleteSnapshotIds?: ReadonlySet<string>
  listedSnapshotSandboxNames?: string[]
  retentionSandboxNames?: string[]
  sandboxes: SandboxRecord[]
  snapshotsBySandbox: Record<string, SnapshotRecord[]>
}): SandboxSnapshotCleanupClient {
  return {
    deleteSnapshot(deleteInput) {
      input.deletedSnapshotIds?.push(deleteInput.snapshotId)
      if (input.failedDeleteSnapshotIds?.has(deleteInput.snapshotId)) {
        return Promise.reject(
          new Error(`delete failed for ${deleteInput.snapshotId}`)
        )
      }
      return Promise.resolve()
    },
    listSandboxes() {
      return Promise.resolve({
        pagination: {},
        sandboxes: input.sandboxes,
      })
    },
    listSnapshots(listInput) {
      input.listedSnapshotSandboxNames?.push(listInput.sandboxName)
      return Promise.resolve({
        pagination: {},
        snapshots: input.snapshotsBySandbox[listInput.sandboxName] ?? [],
      })
    },
    updateSandboxRetention(updateInput) {
      input.retentionSandboxNames?.push(updateInput.sandboxName)
      return Promise.resolve()
    },
  }
}
