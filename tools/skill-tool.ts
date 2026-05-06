import { type Tool, tool } from 'ai'
import { z } from 'zod'
import { extractSkillBody } from '@/lib/agent-skill-parser'

/**
 * Vercel-Sandbox port of bash-tool's `experimental_createSkillTool`.
 *
 * The upstream package (https://github.com/vercel-labs/bash-tool) reads
 * skills from the local Node filesystem at `skillsDirectory`. Here we
 * read them from the agent's Postgres-backed skills store and mirror
 * them into the exec sandbox at `${EXEC_SANDBOX_WORKSPACE}/skills/<name>/`
 * before the agent's loop runs (see `syncAgentSkills`). The AI-SDK
 * `skill` tool's `execute` fetches `SKILL.md` from that same exec
 * sandbox the bash tool shells into, so the agent's "load instructions,
 * then run scripts" workflow keeps its upstream shape — identical to
 * the README example, just without local-disk dependencies.
 *
 * The tool itself never holds a sandbox handle; it goes through a
 * caller-supplied `readSkillMd` callback so the resume-by-id boundary
 * stays inside a workflow `'use step'` function (mirroring how the
 * bash / file_read tools work in `workflows/agent-session/tools/exec-tools.ts`).
 */

export interface SkillToolEntry {
  description: string
  /** File paths inside the skill, relative to the skill root. */
  files: string[]
  /** Slug used as the AI-SDK tool's `skillName` argument. */
  name: string
  /** Posix path inside the sandbox: `${destination}/<name>`. */
  sandboxPath: string
}

export interface SkillToolkit {
  /** Extra system-prompt block summarising available skill paths. */
  instructions: string
  /** AI-SDK tool the agent invokes to load a skill's SKILL.md content. */
  skill: Tool
  /** Registry of synced skills with metadata. */
  skills: SkillToolEntry[]
}

export interface CreateSkillToolInput {
  /**
   * Resolves the SKILL.md content for a given skill, reading from
   * whatever filesystem the host wires up — typically the exec Vercel
   * Sandbox via `getExecSandbox(...).readFileToBuffer(...)`.
   */
  readSkillMd: (input: {
    skillName: string
    sandboxPath: string
  }) => Promise<string | null>
  /** Skill metadata to expose to the agent. */
  skills: SkillToolEntry[]
}

const skillSchema = z.object({
  skillName: z.string().describe('The name of the skill to load'),
})

export function createSkillTool(input: CreateSkillToolInput): SkillToolkit {
  const { skills, readSkillMd } = input
  const skillMap = new Map(skills.map((s) => [s.name, s]))

  const skillTool = tool({
    description: generateDescription(skills),
    inputSchema: skillSchema,
    execute: async ({ skillName }) => {
      const entry = skillMap.get(skillName)
      if (!entry) {
        const availableNames = skills.map((s) => s.name).join(', ')
        return {
          success: false as const,
          error: `Skill "${skillName}" not found. Available skills: ${availableNames || 'none'}`,
        }
      }
      try {
        const content = await readSkillMd({
          skillName,
          sandboxPath: entry.sandboxPath,
        })
        if (content === null) {
          return {
            success: false as const,
            error: `Failed to read skill "${skillName}": SKILL.md not found at ${entry.sandboxPath}/SKILL.md.`,
          }
        }
        return {
          success: true as const,
          skill: {
            name: entry.name,
            description: entry.description,
            path: entry.sandboxPath,
          },
          instructions: extractSkillBody(content),
          files: entry.files.filter((f) => f !== 'SKILL.md'),
        }
      } catch (err) {
        return {
          success: false as const,
          error: `Failed to read skill "${skillName}": ${err instanceof Error ? err.message : String(err)}`,
        }
      }
    },
  })

  return {
    skill: skillTool,
    skills,
    instructions: generateSkillInstructions(skills),
  }
}

function generateDescription(entries: SkillToolEntry[]): string {
  const lines: string[] = [
    "Load a skill's instructions to learn how to use it.",
    "You can load multiple skills - each call returns that skill's instructions. Treat the returned instructions as authoritative.",
    '',
    'Available skills:',
  ]
  if (entries.length === 0) {
    lines.push('  (no skills found)')
  } else {
    for (const entry of entries) {
      lines.push(
        `  - skill(${JSON.stringify(entry.name)}): ${entry.description}`
      )
    }
  }
  lines.push('')
  lines.push(
    "After loading a skill, use the bash tool to run its scripts from the skill's directory."
  )
  return lines.join('\n')
}

function generateSkillInstructions(entries: SkillToolEntry[]): string {
  if (entries.length === 0) {
    return ''
  }
  const lines = [
    'SKILL DIRECTORIES:',
    'Skills are available at the following paths:',
  ]
  for (const entry of entries) {
    lines.push(`  ${entry.sandboxPath}/ - ${entry.name}: ${entry.description}`)
  }
  lines.push('')
  lines.push('To use a skill:')
  lines.push("  1. Call skill to get the skill's instructions")
  lines.push('  2. Run scripts from the skill directory with bash')
  return lines.join('\n')
}
