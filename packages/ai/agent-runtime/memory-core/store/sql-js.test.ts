import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_DREAMING_CONFIG } from '../config'
import { extractEvidenceSnippets } from '../extract'
import {
  beginSweep,
  listActiveCandidates,
  upsertEvidenceSnippets,
} from './operations'
import { openDreamingSqlite } from './sql-js'

describe('DreamingStore sql.js adapter', () => {
  it('creates, exports, reopens, and queries a Drizzle-backed SQLite store', async () => {
    const opened = await openDreamingSqlite()
    const store = {
      db: opened.db,
      export: opened.exportBytes,
      save: vi.fn(),
    }

    beginSweep({
      agentId: 'agent_123',
      attempt: 1,
      eventId: 'evt_123',
      localDate: '2026-06-08',
      nowIso: '2026-06-08T10:00:00.000Z',
      store,
      sweepId: 'sweep_evt_123',
    })

    const snippets = extractEvidenceSnippets({
      observedAt: '2026-06-08T10:00:00.000Z',
      path: 'logs/2026-06-08.md',
      sourceId: 'logs/2026-06-08.md',
      sourceType: 'log',
      text: '- Tommaso prefers implementation plans before coding.\n',
    })
    upsertEvidenceSnippets({
      config: DEFAULT_DREAMING_CONFIG,
      now: new Date('2026-06-08T10:00:00.000Z'),
      snippets,
      store,
    })
    upsertEvidenceSnippets({
      config: DEFAULT_DREAMING_CONFIG,
      now: new Date('2026-06-08T10:00:00.000Z'),
      snippets,
      store,
    })

    const exported = Buffer.from(opened.exportBytes())
    opened.sqlite.close()

    const reopened = await openDreamingSqlite({ buffer: exported })
    const reopenedStore = {
      db: reopened.db,
      export: reopened.exportBytes,
      save: vi.fn(),
    }
    const candidates = listActiveCandidates(reopenedStore)
    reopened.sqlite.close()

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.recallCount).toBe(1)
  })
})
