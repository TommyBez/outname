import { getExecSandbox } from '@/lib/agent-sandbox'
import { EXEC_SANDBOX_WORKSPACE } from '@/lib/agent-sandbox-registry'
import { loadAgentSkillsWithFiles } from '@/lib/agent-skill-service'

export interface SyncedSkill {
  description: string
  files: Array<{ path: string; sha256: string; executable: boolean }>
  name: string
  sandboxPath: string
}

export interface SyncAgentSkillsResult {
  destination: string
  skills: SyncedSkill[]
}

/**
 * Mirror the agent's DB-backed skills into the exec sandbox so the
 * Vercel-Sandbox flavour of `createSkillTool` (and any bash scripts the
 * agent wants to invoke) can read them as ordinary files. Files are
 * written under `${EXEC_SANDBOX_WORKSPACE}/skills/<name>/...`.
 *
 * Files are written wholesale per session boot rather than diffed against
 * what's already on disk. The exec sandbox snapshot persists across events,
 * but skill ingest can happen between events through the UI; rewriting on
 * boot keeps the sandbox the single source of truth for tool reads.
 */
export async function syncAgentSkills(input: {
  agentId: string
}): Promise<SyncAgentSkillsResult> {
  'use step'
  const destination = `${EXEC_SANDBOX_WORKSPACE}/skills`

  const skills = await loadAgentSkillsWithFiles(input.agentId)
  if (skills.length === 0) {
    return { destination, skills: [] }
  }

  const sandbox = await getExecSandbox(input.agentId)

  const writes: { path: string; content: Buffer }[] = []
  const synced: SyncedSkill[] = []
  const executablePaths: string[] = []

  for (const entry of skills) {
    const sandboxPath = `${destination}/${entry.skill.name}`
    const summarised: SyncedSkill = {
      name: entry.skill.name,
      description: entry.skill.description,
      sandboxPath,
      files: [],
    }
    for (const file of entry.files) {
      const fullPath = `${sandboxPath}/${file.path}`
      writes.push({
        path: fullPath,
        content: Buffer.from(file.content, 'utf8'),
      })
      summarised.files.push({
        path: file.path,
        sha256: file.sha256,
        executable: file.executable,
      })
      if (file.executable) {
        executablePaths.push(fullPath)
      }
    }
    synced.push(summarised)
  }

  if (writes.length > 0) {
    await sandbox.writeFiles(writes)
  }
  if (executablePaths.length > 0) {
    // `writeFiles` does not preserve executable bits; fix them up so
    // `./scripts/run.sh` works inside the bash tool.
    const args = ['+x', ...executablePaths]
    await sandbox.runCommand({ cmd: 'chmod', args })
  }

  return { destination, skills: synced }
}
