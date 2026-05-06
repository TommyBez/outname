import type { Tool } from 'ai'
import { getExecSandbox } from '@/lib/agent-sandbox'
import {
  createSkillTool,
  type SkillToolEntry,
  type SkillToolkit,
} from '@/tools/skill-tool'
import type { SyncedSkill } from '../steps/sync-agent-skills'

/**
 * Workflow-side wiring for the AI-SDK skill tool. Owns the boundary
 * crossings the tool body needs:
 *
 *   - `'use step'` reads from the exec Vercel Sandbox by id (mirroring
 *     the pattern used by `createExecTools`/`createAgentBashTool`).
 *
 * The actual `createSkillTool` factory is sandbox-agnostic — it accepts
 * a `readSkillMd` callback so unit tests, alternate sandboxes, or
 * future remote storage can be swapped in without touching the AI-SDK
 * surface.
 */

export interface SkillToolsContext {
  agentId: string
  destination: string
  skills: SyncedSkill[]
}

export function createSkillTools(ctx: SkillToolsContext): {
  tools: Record<string, Tool>
  instructions: string
} {
  if (ctx.skills.length === 0) {
    return { tools: {}, instructions: '' }
  }

  const entries: SkillToolEntry[] = ctx.skills.map((s) => ({
    name: s.name,
    description: s.description,
    sandboxPath: s.sandboxPath,
    files: s.files.map((f) => f.path),
  }))

  const toolkit: SkillToolkit = createSkillTool({
    skills: entries,
    readSkillMd: ({ sandboxPath }) =>
      readSkillMdFromSandbox({
        agentId: ctx.agentId,
        path: `${sandboxPath}/SKILL.md`,
      }),
  })

  return {
    tools: { skill: toolkit.skill },
    instructions: toolkit.instructions,
  }
}

async function readSkillMdFromSandbox(input: {
  agentId: string
  path: string
}): Promise<string | null> {
  'use step'
  const sandbox = await getExecSandbox(input.agentId)
  const buf = await sandbox.readFileToBuffer({ path: input.path })
  return buf ? buf.toString('utf8') : null
}
