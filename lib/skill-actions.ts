'use server'

import {
  addSkillFromGithub,
  addSkillFromMarkdown,
  addSkillFromZip,
  removeSkill,
} from '@/lib/agent-skill-service'
import type { SkillIngestResult } from '@/lib/agent-skill-types'
import { requireUserId } from '@/lib/auth-guard'

export async function addSkillFromMarkdownAction(input: {
  agentId: string
  content: string
  sourceLabel?: string
}): Promise<SkillIngestResult> {
  const userId = await requireUserId()
  return addSkillFromMarkdown({
    agentId: input.agentId,
    userId,
    content: input.content,
    sourceLabel: input.sourceLabel,
  })
}

export async function addSkillFromZipAction(input: {
  agentId: string
  /** Base64 of the zip bytes — server actions can't carry Uint8Array directly. */
  base64: string
  sourceLabel?: string
}): Promise<SkillIngestResult> {
  const userId = await requireUserId()
  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(Buffer.from(input.base64, 'base64'))
  } catch {
    return { ok: false, error: 'Invalid zip payload.' }
  }
  return addSkillFromZip({
    agentId: input.agentId,
    userId,
    bytes,
    sourceLabel: input.sourceLabel,
  })
}

export async function addSkillFromGithubAction(input: {
  agentId: string
  source: string
}): Promise<SkillIngestResult> {
  const userId = await requireUserId()
  return addSkillFromGithub({
    agentId: input.agentId,
    userId,
    source: input.source,
  })
}

export async function removeSkillAction(input: {
  agentId: string
  name: string
}): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId()
  return removeSkill({
    agentId: input.agentId,
    name: input.name,
    userId,
  })
}
