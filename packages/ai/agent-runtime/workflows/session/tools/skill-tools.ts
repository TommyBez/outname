import { getSkillSandbox } from '@outname/ai/agent-runtime/server/agent-skill-sandbox'
import type { RuntimeSkill } from '@outname/ai/agent-runtime/skills/discovery'
import {
  SKILL_SANDBOX_ROOT,
  SKILL_WORKSPACE_DIR,
} from '@outname/ai/agent-runtime/skills/paths'
import {
  normalizeSkillName,
  parseSkillMd,
} from '@outname/ai/agent-runtime/skills/skill-md'
import type { SkillPlan } from '@outname/ai/agent-runtime/workflows/session/steps/resolve-skill-plan'
import { ensureParentDirectories } from '@outname/ai/agent-runtime/workflows/session/tools/sandbox-file-helpers/write'
import type { Sandbox } from '@vercel/sandbox'
import { z } from 'zod'

const MAX_BASH_OUTPUT_CHARS = 30_000
const MAX_LISTED_SKILL_FILES = 500
const LEADING_SLASHES_PATTERN = /^\/+/
const BASH_TOOL_PROMPT = [
  'This bash tool runs in the agent Skill Sandbox at /vercel/sandbox.',
  'Installed skill packages are under /vercel/sandbox/skills/<slug>.',
  'The working directory is /vercel/sandbox/workspace.',
  "Use the skill tool to load a skill's instructions before relying on that skill.",
  'Do not use this bash tool for system memory files; use readFile, writeFile, listFiles, and grepFiles for the system sandbox.',
].join('\n')

const skillInputSchema = z.object({
  skillName: z.string().min(1).describe('Name of the skill to load.'),
})

const bashInputSchema = z.object({
  command: z
    .string()
    .min(1)
    .describe('Bash command to execute in the Skill Sandbox workspace.'),
})

interface ListedSkillFile {
  executable: boolean
  fullPath: string
  path: string
}

interface BashToolSandboxAdapter {
  executeCommand(command: string): Promise<{
    exitCode: number
    stderr: string
    stdout: string
  }>
  readFile(path: string): Promise<string>
  writeFiles(
    files: Array<{
      content: string | Buffer
      path: string
    }>
  ): Promise<void>
}

type BashToolExecutor<TInput> = (
  input: TInput,
  options?: unknown
) => Promise<unknown>

export function createSkillTools(ctx: {
  agentId: string
  skillPlan: SkillPlan
}) {
  if (ctx.skillPlan.skills.length === 0) {
    return {}
  }

  return {
    skill: {
      description: generateSkillDescription(ctx.skillPlan.skills),
      inputSchema: skillInputSchema,
      execute: async ({ skillName }: { skillName: string }) =>
        await loadSkillStep({
          agentId: ctx.agentId,
          skillName,
          skills: ctx.skillPlan.skills,
        }),
    },
    bash: {
      description: generateBashDescription(ctx.skillPlan.skills),
      inputSchema: bashInputSchema,
      execute: async ({ command }: { command: string }, options?: unknown) =>
        await executeSkillBashStep({
          agentId: ctx.agentId,
          command,
          options,
          skills: ctx.skillPlan.skills,
        }),
    },
  }
}

async function loadSkillStep(input: {
  agentId: string
  skillName: string
  skills: RuntimeSkill[]
}): Promise<unknown> {
  'use step'
  const normalized = normalizeSkillName(input.skillName)
  const skill = input.skills.find((item) => item.nameNormalized === normalized)
  if (!skill) {
    const availableNames = input.skills.map((item) => item.name).join(', ')
    return {
      success: false,
      error: `Skill "${input.skillName}" not found. Available skills: ${availableNames || 'none'}`,
    }
  }

  try {
    const sandbox = await getSkillSandbox(input.agentId)
    const content = await sandbox.readFileToBuffer({ path: skill.skillMdPath })
    if (!content) {
      throw new Error(`SKILL.md not found at ${skill.skillMdPath}`)
    }
    const parsed = parseSkillMd(content.toString('utf8'))
    return {
      success: true,
      skill: {
        name: parsed.name,
        description: parsed.description,
        path: skill.path,
      },
      instructions: parsed.instructions.trim(),
      files: await listSkillFiles({
        sandbox,
        skill,
      }),
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to read skill "${input.skillName}": ${errorMessage(error)}`,
    }
  }
}

async function executeSkillBashStep(input: {
  agentId: string
  command: string
  options?: unknown
  skills: RuntimeSkill[]
}): Promise<unknown> {
  'use step'
  const bashTool = await createSkillBashToolForStep({
    agentId: input.agentId,
    skills: input.skills,
  })
  return await bashTool.bash.execute({ command: input.command }, input.options)
}

async function createSkillBashToolForStep(input: {
  agentId: string
  skills: RuntimeSkill[]
}): Promise<{
  bash: { execute: BashToolExecutor<{ command: string }> }
  tools: {
    bash: { execute: BashToolExecutor<{ command: string }> }
    readFile: unknown
    writeFile: unknown
  }
}> {
  const sandbox = await getSkillSandbox(input.agentId)
  const { createBashTool } = (await import('bash-tool')) as unknown as {
    createBashTool(args: {
      destination: string
      extraInstructions: string
      maxFiles: number
      maxOutputLength: number
      promptOptions: { toolPrompt: string }
      sandbox: BashToolSandboxAdapter
    }): Promise<{
      bash: { execute: BashToolExecutor<{ command: string }> }
      tools: {
        bash: { execute: BashToolExecutor<{ command: string }> }
        readFile: unknown
        writeFile: unknown
      }
    }>
  }

  return await createBashTool({
    destination: SKILL_WORKSPACE_DIR,
    extraInstructions: generateSkillBashInstructions(input.skills),
    maxFiles: 0,
    maxOutputLength: MAX_BASH_OUTPUT_CHARS,
    promptOptions: {
      toolPrompt: BASH_TOOL_PROMPT,
    },
    sandbox: createSkillSandboxAdapter({ sandbox }),
  })
}

function createSkillSandboxAdapter(input: {
  sandbox: Sandbox
}): BashToolSandboxAdapter {
  return {
    async executeCommand(command) {
      const result = await input.sandbox.runCommand({
        cmd: 'bash',
        args: ['-lc', command],
      })
      const [stdout, stderr] = await Promise.all([
        result.stdout(),
        result.stderr(),
      ])
      return {
        exitCode: result.exitCode,
        stdout,
        stderr,
      }
    },
    async readFile(path) {
      const safe = normalizeSkillSandboxPath(path)
      const content = await input.sandbox.readFileToBuffer({ path: safe })
      if (!content) {
        throw new Error(`readFile: file not found: ${safe}`)
      }
      return decodeUtf8(content, safe)
    },
    async writeFiles(files) {
      const prepared = files.map((file) => ({
        content:
          typeof file.content === 'string'
            ? Buffer.from(file.content, 'utf8')
            : file.content,
        path: normalizeSkillSandboxPath(file.path),
      }))
      await ensureParentDirectories({
        paths: prepared.map((file) => file.path),
        root: SKILL_SANDBOX_ROOT,
        sandbox: input.sandbox,
      })
      await input.sandbox.writeFiles(prepared)
    },
  }
}

async function listSkillFiles(input: {
  sandbox: Sandbox
  skill: RuntimeSkill
}): Promise<ListedSkillFile[]> {
  const result = await input.sandbox.runCommand({
    cmd: 'find',
    args: [input.skill.path, '-type', 'f', '-print'],
  })
  if (result.exitCode !== 0) {
    return []
  }

  const stdout = await result.stdout()
  const fullPaths = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((path) => path !== input.skill.skillMdPath)
    .filter((path) => path.startsWith(`${input.skill.path}/`))
    .sort()
    .slice(0, MAX_LISTED_SKILL_FILES)

  const files: ListedSkillFile[] = []
  for (const fullPath of fullPaths) {
    files.push({
      executable: await isExecutable(input.sandbox, fullPath),
      fullPath,
      path: fullPath.slice(input.skill.path.length + 1),
    })
  }
  return files
}

async function isExecutable(
  sandbox: Sandbox,
  fullPath: string
): Promise<boolean> {
  const result = await sandbox.runCommand({
    cmd: 'test',
    args: ['-x', fullPath],
  })
  return result.exitCode === 0
}

function generateSkillDescription(skills: RuntimeSkill[]): string {
  const lines = [
    "Load a skill's instructions to learn how to use it.",
    "You can load multiple skills - each call returns that skill's instructions. Treat the returned instructions as authoritative.",
    '',
    'Available skills:',
  ]
  for (const skill of skills) {
    lines.push(`  - skill(${JSON.stringify(skill.name)}): ${skill.description}`)
  }
  lines.push('')
  lines.push(
    "After loading a skill, use the bash tool to run its scripts from the skill's directory."
  )
  return lines.join('\n')
}

function generateBashDescription(skills: RuntimeSkill[]): string {
  return [
    'Execute bash commands in the agent Skill Sandbox.',
    '',
    `WORKING DIRECTORY: ${SKILL_WORKSPACE_DIR}`,
    'All commands execute from this directory. Use relative paths from here.',
    '',
    BASH_TOOL_PROMPT,
    '',
    generateSkillBashInstructions(skills),
    '',
    'Common operations:',
    '  ls -la',
    "  find . -name '*.ts'",
    "  grep -r 'pattern' .",
    '  cat <file>',
  ].join('\n')
}

function generateSkillBashInstructions(skills: RuntimeSkill[]): string {
  const lines = [
    'SKILL DIRECTORIES:',
    'Skills are available at the following paths:',
  ]
  for (const skill of skills) {
    lines.push(`  ${skill.path}/ - ${skill.name}: ${skill.description}`)
  }
  lines.push('')
  lines.push('To use a skill:')
  lines.push("  1. Call skill to get the skill's instructions")
  lines.push('  2. Run scripts from the skill directory with bash')
  return lines.join('\n')
}

function normalizeSkillSandboxPath(path: string): string {
  const raw = path.trim()
  const absolute = raw.startsWith('/')
    ? raw
    : `${SKILL_SANDBOX_ROOT}/${raw.replace(LEADING_SLASHES_PATTERN, '')}`
  const segments: string[] = []
  for (const segment of absolute.split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      throw new Error(`Path may not escape ${SKILL_SANDBOX_ROOT}: ${path}`)
    }
    segments.push(segment)
  }
  const normalized = `/${segments.join('/')}`
  if (
    normalized !== SKILL_SANDBOX_ROOT &&
    !normalized.startsWith(`${SKILL_SANDBOX_ROOT}/`)
  ) {
    throw new Error(`Path must stay inside ${SKILL_SANDBOX_ROOT}: ${path}`)
  }
  return normalized
}

function decodeUtf8(content: Buffer, path: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(content)
  } catch {
    throw new Error(`readFile: ${path} is not valid UTF-8 text.`)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
