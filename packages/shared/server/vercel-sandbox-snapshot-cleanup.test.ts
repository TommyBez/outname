import { afterEach, describe, expect, it } from 'vitest'
import { PERSISTENT_SANDBOX_RETENTION_OPTIONS } from './vercel-sandbox-config'
import {
  buildVercelSandboxSnapshotCleanupPlan,
  executeVercelSandboxSnapshotCleanupPlan,
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

  it('rejects invalid timing inputs before cleanup planning', async () => {
    setSandboxCredentialEnv()

    const client = createFakeClient({
      sandboxes: [],
      snapshotsBySandbox: {},
    })

    await expect(
      sweepUnusedVercelSandboxSnapshots({
        client,
        execute: false,
        now: NOW,
        olderThanDays: 0,
      })
    ).rejects.toThrow('olderThanDays must be a positive integer, or null.')

    await expect(
      sweepUnusedVercelSandboxSnapshots({
        client,
        execute: false,
        now: Number.NaN,
        olderThanDays: 1,
      })
    ).rejects.toThrow('now must be a finite timestamp.')
  })

  it('aggregates paginated sandbox and snapshot listings', async () => {
    setSandboxCredentialEnv()

    const listedSandboxCursors: (string | undefined)[] = []
    const listedSnapshotCursors: Record<string, (string | undefined)[]> = {}
    const client = createFakeClient({
      listedSandboxCursors,
      listedSnapshotCursors,
      sandboxPages: [
        {
          items: [persistentSandbox({ name: 'sandbox-a' })],
          next: 'sandboxes-page-2',
        },
        {
          cursor: 'sandboxes-page-2',
          items: [persistentSandbox({ name: 'sandbox-b' })],
        },
      ],
      snapshotPagesBySandbox: {
        'sandbox-a': [
          {
            items: [
              createdSnapshot({
                createdAt: TWO_DAYS_AGO,
                id: 'snap-a-small',
                sizeBytes: 1000,
              }),
            ],
            next: 'snapshots-page-2',
          },
          {
            cursor: 'snapshots-page-2',
            items: [
              createdSnapshot({
                createdAt: TWO_DAYS_AGO,
                id: 'snap-a-large',
                sizeBytes: 3000,
              }),
            ],
          },
        ],
        'sandbox-b': [
          {
            items: [
              createdSnapshot({
                createdAt: TWO_DAYS_AGO,
                id: 'snap-b-medium',
                sizeBytes: 2000,
              }),
            ],
          },
        ],
      },
      sandboxes: [],
      snapshotsBySandbox: {},
    })

    const result = await sweepUnusedVercelSandboxSnapshots({
      client,
      execute: false,
      now: NOW,
      olderThanDays: 1,
    })

    expect(listedSandboxCursors).toEqual([undefined, 'sandboxes-page-2'])
    expect(listedSnapshotCursors).toEqual({
      'sandbox-a': [undefined, 'snapshots-page-2'],
      'sandbox-b': [undefined],
    })
    expect(
      result.plan.candidates.map((candidate) => candidate.snapshot.id)
    ).toEqual(['snap-a-large', 'snap-b-medium', 'snap-a-small'])
  })

  it('executes a prebuilt plan without rebuilding candidates', async () => {
    setSandboxCredentialEnv()

    const deletedSnapshotIds: string[] = []
    const listedSnapshotSandboxNames: string[] = []
    const snapshotsBySandbox = {
      'sandbox-a': [
        createdSnapshot({
          createdAt: TWO_DAYS_AGO,
          id: 'snap-confirmed',
          sizeBytes: 1000,
        }),
      ],
    }
    const client = createFakeClient({
      deletedSnapshotIds,
      listedSnapshotSandboxNames,
      sandboxes: [persistentSandbox({ name: 'sandbox-a' })],
      snapshotsBySandbox,
    })

    const plan = await buildVercelSandboxSnapshotCleanupPlan({
      client,
      now: NOW,
      olderThanDays: 1,
    })
    snapshotsBySandbox['sandbox-a'] = [
      createdSnapshot({
        createdAt: TWO_DAYS_AGO,
        id: 'snap-after-confirmation',
        sizeBytes: 2000,
      }),
    ]
    listedSnapshotSandboxNames.length = 0

    const result = await executeVercelSandboxSnapshotCleanupPlan({
      client,
      plan,
    })

    expect(listedSnapshotSandboxNames).toEqual([])
    expect(deletedSnapshotIds).toEqual(['snap-confirmed'])
    expect(
      result.plan.candidates.map((candidate) => candidate.snapshot.id)
    ).toEqual(['snap-confirmed'])
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

interface FakePage<TItem> {
  cursor?: string
  items: TItem[]
  next?: string
}

function createFakeClient(input: {
  deletedSnapshotIds?: string[]
  failedDeleteSnapshotIds?: ReadonlySet<string>
  listedSandboxCursors?: (string | undefined)[]
  listedSnapshotSandboxNames?: string[]
  listedSnapshotCursors?: Record<string, (string | undefined)[]>
  sandboxPages?: FakePage<SandboxRecord>[]
  retentionSandboxNames?: string[]
  sandboxes: SandboxRecord[]
  snapshotPagesBySandbox?: Record<string, FakePage<SnapshotRecord>[]>
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
    listSandboxes(listInput) {
      input.listedSandboxCursors?.push(listInput.cursor)
      if (input.sandboxPages) {
        const page = readFakePage(input.sandboxPages, listInput.cursor)
        return Promise.resolve({
          pagination: { next: page.next },
          sandboxes: page.items,
        })
      }

      return Promise.resolve({
        pagination: {},
        sandboxes: input.sandboxes,
      })
    },
    listSnapshots(listInput) {
      input.listedSnapshotSandboxNames?.push(listInput.sandboxName)
      const cursors = input.listedSnapshotCursors?.[listInput.sandboxName] ?? []
      cursors.push(listInput.cursor)
      if (input.listedSnapshotCursors) {
        input.listedSnapshotCursors[listInput.sandboxName] = cursors
      }

      const pages = input.snapshotPagesBySandbox?.[listInput.sandboxName]
      if (pages) {
        const page = readFakePage(pages, listInput.cursor)
        return Promise.resolve({
          pagination: { next: page.next },
          snapshots: page.items,
        })
      }

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

function readFakePage<TItem>(
  pages: readonly FakePage<TItem>[],
  cursor: string | undefined
): FakePage<TItem> {
  const requestedCursor = cursor ?? ''
  const page = pages.find(
    (candidate) => (candidate.cursor ?? '') === requestedCursor
  )
  if (!page) {
    throw new Error(
      `Missing fake page for cursor ${requestedCursor || '<first>'}.`
    )
  }

  return page
}
