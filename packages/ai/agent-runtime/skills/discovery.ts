import { SKILL_PACKAGES_DIR } from '@outname/ai/agent-runtime/skills/paths'
import type { Sandbox } from '@vercel/sandbox'
import { parseSkillMd } from './skill-md'

export interface RuntimeSkill {
  description: string
  name: string
  nameNormalized: string
  path: string
  skillMdPath: string
  slug: string
}

export async function discoverRuntimeSkills(input: {
  sandbox: Sandbox
}): Promise<RuntimeSkill[]> {
  const skillMdPaths = await findSkillMdPaths(input.sandbox)
  const candidates: RuntimeSkill[] = []

  for (const skillMdPath of skillMdPaths) {
    const slug = slugFromSkillMdPath(skillMdPath)
    if (!slug || slug.startsWith('.')) {
      continue
    }

    const content = await readSkillMd(input.sandbox, skillMdPath)
    if (content === null) {
      continue
    }

    try {
      const parsed = parseSkillMd(content)
      candidates.push({
        description: parsed.description,
        name: parsed.name,
        nameNormalized: parsed.nameNormalized,
        path: `${SKILL_PACKAGES_DIR}/${slug}`,
        skillMdPath,
        slug,
      })
    } catch (error) {
      console.warn(
        `[agent-skills] ignored invalid SKILL.md at ${skillMdPath}`,
        error
      )
    }
  }

  const byName = new Map<string, RuntimeSkill>()
  for (const skill of candidates.sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (byName.has(skill.nameNormalized)) {
      console.warn(
        `[agent-skills] duplicate skill name "${skill.name}" ignored at ${skill.path}`
      )
      continue
    }
    byName.set(skill.nameNormalized, skill)
  }

  return Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}

async function findSkillMdPaths(sandbox: Sandbox): Promise<string[]> {
  const result = await sandbox.runCommand({
    cmd: 'find',
    args: [
      SKILL_PACKAGES_DIR,
      '-mindepth',
      '2',
      '-maxdepth',
      '2',
      '-name',
      'SKILL.md',
      '-type',
      'f',
      '-print',
    ],
  })
  if (result.exitCode !== 0) {
    return []
  }
  const stdout = await result.stdout()
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort()
}

async function readSkillMd(
  sandbox: Sandbox,
  path: string
): Promise<string | null> {
  try {
    const content = await sandbox.readFileToBuffer({ path })
    return content?.toString('utf8') ?? null
  } catch {
    return null
  }
}

function slugFromSkillMdPath(path: string): string | null {
  const prefix = `${SKILL_PACKAGES_DIR}/`
  if (!(path.startsWith(prefix) && path.endsWith('/SKILL.md'))) {
    return null
  }
  const rest = path.slice(prefix.length)
  const segments = rest.split('/')
  return segments.length === 2 && segments[1] === 'SKILL.md'
    ? segments[0]
    : null
}
