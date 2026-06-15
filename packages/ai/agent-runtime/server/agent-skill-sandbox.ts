import {
  SKILL_PACKAGES_DIR,
  SKILL_WORKSPACE_DIR,
} from '@outname/ai/agent-runtime/skills/paths'
import {
  getVercelSandboxCredentials,
  PERSISTENT_SANDBOX_RETENTION_OPTIONS,
  skillSandboxTags,
  type VercelSandboxGetOrCreateOptions,
  type VercelSandboxGetOrCreateRuntimeOptions,
} from '@outname/shared/server/vercel-sandbox-config'
import { Sandbox } from '@vercel/sandbox'
import { createAgentSandboxAccessor } from './agent-sandbox-accessor'

// Keep this object narrower than the full SDK union: skill sandboxes only use
// the runtime-oriented subset of get-or-create options.
const SKILL_SANDBOX_CREATE_OPTIONS: VercelSandboxGetOrCreateRuntimeOptions = {
  ...PERSISTENT_SANDBOX_RETENTION_OPTIONS,
  persistent: true,
  runtime: 'node22',
  timeout: 60 * 60 * 1000,
  resources: { vcpus: 1 },
  networkPolicy: 'allow-all',
}

export function isMissingSkillSandboxError(
  error: unknown,
  agentId: string
): boolean {
  return skillSandboxAccessor.isMissingSandboxError(error, agentId)
}

export interface EnsureSkillSandboxResult {
  created: boolean
  sandbox: Sandbox
}

export async function ensureSkillSandbox(
  agentId: string
): Promise<EnsureSkillSandboxResult> {
  const desiredName = skillSandboxAccessor.nameFor(agentId)
  const persistedName = await skillSandboxAccessor.readSandboxId(agentId)
  let created = false
  const options: VercelSandboxGetOrCreateOptions = {
    ...SKILL_SANDBOX_CREATE_OPTIONS,
    ...getVercelSandboxCredentials(),
    name: persistedName ?? desiredName,
    tags: skillSandboxTags(agentId),
    onCreate: () => {
      created = true
      return Promise.resolve()
    },
  }
  const sandbox = await Sandbox.getOrCreate(options)

  if (!persistedName) {
    await skillSandboxAccessor.writeSandboxId(agentId, desiredName)
  }

  await ensureSkillSandboxDirectories(sandbox)
  return { sandbox, created }
}

export async function getSkillSandbox(
  agentId: string,
  sandboxName?: string
): Promise<Sandbox> {
  return await skillSandboxAccessor.getSandbox(agentId, sandboxName)
}

export async function destroySkillSandbox(agentId: string): Promise<void> {
  await skillSandboxAccessor.destroySandbox(agentId)
}

async function ensureSkillSandboxDirectories(sandbox: Sandbox): Promise<void> {
  for (const path of [SKILL_PACKAGES_DIR, SKILL_WORKSPACE_DIR]) {
    await ensureDirectory(sandbox, path)
  }
}

async function ensureDirectory(sandbox: Sandbox, path: string): Promise<void> {
  try {
    await sandbox.mkDir(path)
    return
  } catch {
    // Older SDK surfaces and already-existing directories can fall through to
    // mkdir -p, which is idempotent.
  }

  const result = await sandbox.runCommand({
    cmd: 'mkdir',
    args: ['-p', path],
  })
  if (result.exitCode !== 0) {
    const stderr = await result.stderr()
    throw new Error(
      stderr.trim() || `Failed to create skill sandbox directory: ${path}`
    )
  }
}

const skillSandboxAccessor = createAgentSandboxAccessor({
  field: 'sandboxSkillsId',
  missingMessage: (agentId) =>
    `Agent ${agentId} has no skill sandbox yet — install an Agent Skill first.`,
  suffix: 'skills',
})
