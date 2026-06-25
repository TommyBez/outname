import 'server-only'

import { db } from '@outname/db'
import { agent } from '@outname/db/schema'
import { SUMMARY_MODEL_ID } from '@outname/shared/server/inference-model-defaults'
import {
  getRequiredDefaultInferenceProvider,
  getUserLanguageModel,
} from '@outname/shared/server/inference-providers'
import { generateText } from 'ai'
import { eq } from 'drizzle-orm'
import { loadSummaryContext } from './capability-summary/context'
import {
  cleanSummary,
  fallbackSummary,
  formatSummaryPrompt,
} from './capability-summary/format'
import type { BootstrapContent } from './capability-summary/types'

export async function refreshAgentCapabilitySummary(input: {
  agentId: string
  bootstrap?: BootstrapContent
}): Promise<string | null> {
  try {
    const context = await loadSummaryContext(input)
    if (!context) {
      return null
    }

    const fallback = fallbackSummary(context)
    let summary = fallback

    try {
      const { text } = await generateText({
        model: await getSummaryModel(context.userId),
        instructions: [
          'You write model-facing descriptions for AI sub-agents.',
          'Return one short paragraph, 1-2 sentences, maximum 450 characters.',
          'Describe when a parent agent should delegate to this sub-agent.',
          'Mention major attached tools by capability, not raw IDs.',
          'Focus only on the type of work the sub-agent can do and notable external tools.',
          'Omit procedures, validation steps, audit trails, persistence details, file names, message IDs, timestamps, logs, database fields, secrets, and implementation details.',
          'Use plain text only, without Markdown formatting.',
        ].join('\n'),
        prompt: formatSummaryPrompt(context),
      })
      summary = cleanSummary(text) || fallback
    } catch (err) {
      if (context.previousSummary) {
        console.error(
          'refreshAgentCapabilitySummary: generation failed; keeping previous summary',
          err
        )
        return context.previousSummary
      }
      console.error(
        'refreshAgentCapabilitySummary: generation failed; using fallback',
        err
      )
    }

    await db
      .update(agent)
      .set({ capabilitySummary: summary })
      .where(eq(agent.id, input.agentId))
    return summary
  } catch (err) {
    console.error('refreshAgentCapabilitySummary failed', err)
    return null
  }
}

async function getSummaryModel(userId: string) {
  const inferenceProvider = await getRequiredDefaultInferenceProvider(userId)
  return await getUserLanguageModel({
    inferenceProvider,
    modelId: SUMMARY_MODEL_ID,
    userId,
  })
}
