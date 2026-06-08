import {
  appendDiarySection,
  appendNarrativeToDiarySection,
} from '@outname/ai/agent-runtime/memory-core/diary'
import { extractEvidenceSnippets } from '@outname/ai/agent-runtime/memory-core/extract'
import {
  appendPromotionsToMemory,
  renderMemoryPromotion,
  selectPromotionCandidates,
} from '@outname/ai/agent-runtime/memory-core/promote'
import {
  beginSweep,
  completeSweep,
  failSweep,
  listActiveCandidates,
  listEvidenceForCandidates,
  recordDeepPromotions,
  runRemPhase,
  upsertEvidenceSnippets,
  writePhaseSignal,
} from '@outname/ai/agent-runtime/memory-core/store/operations'
import { withSandboxDreamingStore } from '@outname/ai/agent-runtime/memory-core/store/sandbox'
import type {
  DreamingConfig,
  DreamingDeepSummary,
  DreamingPhaseSummary,
  DreamingRunSummary,
  EvidenceSnippet,
} from '@outname/ai/agent-runtime/memory-core/types'
import { listRecentCompletedAgentEventTranscriptsForDreaming } from '@outname/ai/agent-runtime/server/agent-event-transcript-store'
import {
  getSystemSandbox,
  SYSTEM_SANDBOX_ROOT,
} from '@outname/ai/agent-runtime/server/agent-sandbox'
import { writeCachedAgentFiles } from '@outname/ai/agent-runtime/server/file-cache'
import { listLiveFiles } from '@outname/ai/agent-runtime/workflows/session/tools/sandbox-file-helpers/list'
import { readLiveFile } from '@outname/ai/agent-runtime/workflows/session/tools/sandbox-file-helpers/read'
import { db } from '@outname/db'
import { agent as agentTable } from '@outname/db/schema'
import type { InferenceProvider } from '@outname/shared/server/inference-providers'
import { getUserLanguageModel } from '@outname/shared/server/inference-providers'
import type { GenerationUsageObservation } from '@outname/shared/server/model-costs'
import type { Sandbox } from '@vercel/sandbox'
import { stepCountIs, ToolLoopAgent } from 'ai'
import { eq } from 'drizzle-orm'
import { buildGenerationUsageObservations } from '../budget'

const LOG_DATE_RE = /^logs\/(\d{4}-\d{2}-\d{2})\.md$/

export async function beginDreamingSweepStep(input: {
  agentId: string
  attempt: number
  eventId: string
  localDate: string
  nowIso: string
  sweepId: string
}): Promise<void> {
  'use step'
  await withSandboxDreamingStore(input.agentId, (store) => {
    beginSweep({ ...input, store })
  })
}

export async function failDreamingSweepStep(input: {
  agentId: string
  error: string
  failedAt: string
  sweepId: string
}): Promise<void> {
  'use step'
  await withSandboxDreamingStore(input.agentId, (store) => {
    failSweep({ ...input, store })
  }).catch(() => undefined)
}

export async function completeDreamingSweepStep(input: {
  agentId: string
  completedAt: string
  sweepId: string
}): Promise<void> {
  'use step'
  await withSandboxDreamingStore(input.agentId, (store) => {
    completeSweep({ ...input, store })
  })
}

export async function runLightPhaseStep(input: {
  agentId: string
  config: DreamingConfig
  localDate: string
  nowIso: string
  userId: string
  sweepId: string
}): Promise<DreamingPhaseSummary> {
  'use step'
  const sandbox = await getSystemSandbox(input.agentId)
  const snippets = [
    ...(await collectLogEvidence({
      agentId: input.agentId,
      config: input.config,
      localDate: input.localDate,
      nowIso: input.nowIso,
      sandbox,
    })),
    ...(await collectTranscriptEvidence({
      agentId: input.agentId,
      config: input.config,
      nowIso: input.nowIso,
      userId: input.userId,
    })),
  ]

  return await withSandboxDreamingStore(input.agentId, (store) => {
    const summary = upsertEvidenceSnippets({
      config: input.config,
      now: new Date(input.nowIso),
      snippets,
      store,
    })
    writePhaseSignal({
      metadata: {
        evidenceSnippets: snippets.length,
      },
      phase: 'light',
      signalType: 'ingestion_summary',
      store,
      sweepId: input.sweepId,
      timestamp: input.nowIso,
    })
    return { ...summary, signalsWritten: 1 }
  })
}

export async function runRemPhaseStep(input: {
  agentId: string
  config: DreamingConfig
  nowIso: string
  sweepId: string
}): Promise<DreamingPhaseSummary> {
  'use step'
  return await withSandboxDreamingStore(input.agentId, (store) =>
    runRemPhase({
      config: input.config,
      now: new Date(input.nowIso),
      nowIso: input.nowIso,
      store,
      sweepId: input.sweepId,
    })
  )
}

export async function runDeepPhaseStep(input: {
  agentId: string
  config: DreamingConfig
  nowIso: string
  sweepId: string
}): Promise<DreamingDeepSummary> {
  'use step'
  const sandbox = await getSystemSandbox(input.agentId)
  const existingMemory = (await readTextFile(sandbox, 'MEMORY.md')) ?? ''
  const rendered = await withSandboxDreamingStore(
    input.agentId,
    (store) => {
      const candidates = listActiveCandidates(store)
      const evidenceByCandidate = listEvidenceForCandidates({
        candidateKeys: candidates.map((candidate) => candidate.key),
        store,
      })
      const promotions = selectPromotionCandidates({
        candidates,
        config: input.config,
        evidenceByCandidate,
        existingMemory,
        now: new Date(input.nowIso),
      })
      return promotions.map((promotion) => {
        const line = renderMemoryPromotion({
          at: input.nowIso,
          config: input.config,
          promotion,
        })
        return {
          key: promotion.candidate.key,
          marker: line.marker,
          text: line.text,
        }
      })
    },
    { save: false }
  )

  if (rendered.length > 0) {
    await writeTextFile({
      agentId: input.agentId,
      content: appendPromotionsToMemory({
        existingMemory,
        lines: rendered.map((promotion) => promotion.text),
      }),
      path: 'MEMORY.md',
      sandbox,
    })
  }

  return await withSandboxDreamingStore(input.agentId, (store) =>
    recordDeepPromotions({
      promotionsWritten: rendered,
      store,
      sweepId: input.sweepId,
      timestamp: input.nowIso,
    })
  )
}

export interface DiaryNarrativeResult {
  inferenceProvider: InferenceProvider
  model: string
  text: string
  usage: GenerationUsageObservation[]
}

export async function runDiaryNarrativeStep(input: {
  agentId: string
  config: DreamingConfig
  localDate: string
  summary: DreamingRunSummary
  userId: string
}): Promise<DiaryNarrativeResult | null> {
  'use step'
  if (!input.config.diaryNarrativeEnabled) {
    return null
  }
  const [agentRow] = await db
    .select({
      inferenceProvider: agentTable.inferenceProvider,
      model: agentTable.model,
    })
    .from(agentTable)
    .where(eq(agentTable.id, input.agentId))
    .limit(1)
  if (!agentRow) {
    return null
  }
  try {
    const model = await getUserLanguageModel({
      inferenceProvider: agentRow.inferenceProvider,
      modelId: agentRow.model,
      userId: input.userId,
    })
    const narrativeAgent = new ToolLoopAgent({
      id: `${input.agentId}:dream-diary`,
      instructions: [
        'You write a compact Dream Diary note for a personal assistant agent.',
        'Use only the prepared sweep summary. Do not claim new facts.',
        'Return plain Markdown, 2-4 bullets maximum.',
        'No tool calls are available.',
      ].join('\n'),
      maxOutputTokens: input.config.narrativeMaxOutputTokens,
      model,
      stopWhen: stepCountIs(1),
      tools: {},
    })
    const result = await narrativeAgent.generate({
      prompt: JSON.stringify(
        {
          localDate: input.localDate,
          summary: input.summary,
        },
        null,
        2
      ),
    })
    const text = result.text.trim()
    if (!text) {
      return null
    }
    return {
      inferenceProvider: agentRow.inferenceProvider,
      model: agentRow.model,
      text,
      usage: buildGenerationUsageObservations(result),
    }
  } catch (error) {
    console.error('[dreaming] diary narrative skipped', {
      agentId: input.agentId,
      error: error instanceof Error ? error.message : 'unknown error',
    })
    return null
  }
}

export async function appendDreamDiaryStep(input: {
  agentId: string
  narrative: string | null
  section: string
}): Promise<void> {
  'use step'
  const sandbox = await getSystemSandbox(input.agentId)
  const existingDreams = (await readTextFile(sandbox, 'DREAMS.md')) ?? ''
  const section = input.narrative
    ? appendNarrativeToDiarySection({
        narrative: input.narrative,
        section: input.section,
      })
    : input.section
  await writeTextFile({
    agentId: input.agentId,
    content: appendDiarySection({ existingDreams, section }),
    path: 'DREAMS.md',
    sandbox,
  })
}

async function collectLogEvidence(input: {
  agentId: string
  config: DreamingConfig
  localDate: string
  nowIso: string
  sandbox: Sandbox
}): Promise<EvidenceSnippet[]> {
  const listed = await listLiveFiles(input.sandbox, {
    maxResults: 1000,
    pathPrefix: 'logs/',
  })
  const cutoff = cutoffDateKey(input.localDate, input.config.lookbackDays)
  const logPaths = listed.paths
    .flatMap((path) => {
      const match = LOG_DATE_RE.exec(path)
      return match?.[1] && match[1] >= cutoff ? [path] : []
    })
    .sort()
  const snippets: EvidenceSnippet[] = []
  for (const path of logPaths) {
    const content = await readLiveFile(input.sandbox, path)
    if (!content) {
      continue
    }
    snippets.push(
      ...extractEvidenceSnippets({
        observedAt: input.nowIso,
        path,
        sourceId: path,
        sourceType: 'log',
        text: content,
      })
    )
  }
  return snippets
}

async function collectTranscriptEvidence(input: {
  agentId: string
  config: DreamingConfig
  nowIso: string
  userId: string
}): Promise<EvidenceSnippet[]> {
  const completedAfter = new Date(
    new Date(input.nowIso).getTime() - input.config.lookbackDays * 86_400_000
  )
  const events = await listRecentCompletedAgentEventTranscriptsForDreaming({
    agentId: input.agentId,
    completedAfter,
    limit: input.config.maxTranscriptEventsPerSweep,
    maxMessagesPerEvent: input.config.maxTranscriptMessagesPerEvent,
    userId: input.userId,
  })
  const snippets: EvidenceSnippet[] = []
  let totalBytes = 0
  for (const event of events) {
    let eventBytes = 0
    const chunks: string[] = []
    for (const message of event.messages) {
      const text = `${message.role}: ${message.text}`
      const bytes = Buffer.byteLength(text, 'utf8')
      if (
        eventBytes + bytes > input.config.maxTranscriptBytesPerEvent ||
        totalBytes + bytes > input.config.maxTranscriptBytesPerSweep
      ) {
        break
      }
      eventBytes += bytes
      totalBytes += bytes
      chunks.push(text)
    }
    if (chunks.length === 0) {
      continue
    }
    snippets.push(
      ...extractEvidenceSnippets({
        maxSnippets: input.config.maxTranscriptSnippetsPerEvent,
        observedAt: input.nowIso,
        sourceId: event.eventId,
        sourceType: 'event_transcript',
        text: chunks.join('\n'),
      })
    )
    if (totalBytes >= input.config.maxTranscriptBytesPerSweep) {
      break
    }
  }
  return snippets
}

async function readTextFile(
  sandbox: Sandbox,
  path: string
): Promise<string | null> {
  return await readLiveFile(sandbox, path)
}

async function writeTextFile(input: {
  agentId: string
  content: string
  path: string
  sandbox: Sandbox
}): Promise<void> {
  const absPath = `${SYSTEM_SANDBOX_ROOT}/${input.path}`
  const dir = absPath.slice(0, absPath.lastIndexOf('/')) || SYSTEM_SANDBOX_ROOT
  if (dir !== SYSTEM_SANDBOX_ROOT) {
    const mkdir = await input.sandbox.runCommand({
      args: ['-p', dir],
      cmd: 'mkdir',
    })
    if (mkdir.exitCode !== 0) {
      const stderr = await mkdir.stderr()
      throw new Error(stderr.trim() || `failed to create ${dir}`)
    }
  }
  await input.sandbox.writeFiles([
    { content: Buffer.from(input.content, 'utf8'), path: absPath },
  ])
  await writeCachedAgentFiles(
    input.agentId,
    [
      {
        content: input.content,
        path: input.path,
        sha256: await sha256Hex(input.content),
        updatedAt: new Date(),
      },
    ],
    { merge: true }
  )
}

function cutoffDateKey(localDate: string, lookbackDays: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - Math.max(0, lookbackDays - 1))
  return date.toISOString().slice(0, 10)
}

async function sha256Hex(content: string): Promise<string> {
  const encoded = new TextEncoder().encode(content)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Buffer.from(digest).toString('hex')
}
