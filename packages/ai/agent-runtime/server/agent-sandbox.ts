import { destroySkillSandbox } from '@outname/ai/agent-runtime/server/agent-skill-sandbox'
import {
  PERSISTENT_SANDBOX_RETENTION_OPTIONS,
  systemSandboxTags,
  withVercelSandboxCredentials,
} from '@outname/shared/server/vercel-sandbox-config'
import { Sandbox } from '@vercel/sandbox'
import { createAgentSandboxAccessor } from './agent-sandbox-accessor'

type SandboxCreateParams = NonNullable<Parameters<typeof Sandbox.create>[0]>
type RuntimeSandboxCreateParams = Exclude<
  SandboxCreateParams,
  { source: { snapshotId: string; type: 'snapshot' } }
>

// Keep this surface narrower than the full SDK union so callers only see the
// create-by-runtime options that matter for system sandboxes.
export type CreateOptions = Pick<
  RuntimeSandboxCreateParams,
  | 'env'
  | 'keepLastSnapshots'
  | 'networkPolicy'
  | 'ports'
  | 'resources'
  | 'runtime'
  | 'snapshotExpiration'
  | 'tags'
  | 'timeout'
>

// Persistent root for bootstrap files, memory files, logs, and any other
// agent-authored documents.
export const SYSTEM_SANDBOX_ROOT = '/vercel/sandbox'

const SYSTEM_SANDBOX_CREATE_OPTIONS: CreateOptions = {
  ...PERSISTENT_SANDBOX_RETENTION_OPTIONS,
  runtime: 'node22',
  // File ops are small and bounded.
  timeout: 60_000,
  resources: { vcpus: 1 },
  networkPolicy: 'deny-all',
}

export function isMissingSystemSandboxError(
  error: unknown,
  agentId: string
): boolean {
  return systemSandboxAccessor.isMissingSandboxError(error, agentId)
}

export interface EnsureResult {
  created: boolean
  sandbox: Sandbox
}

export async function ensureSystemSandbox(
  agentId: string
): Promise<EnsureResult> {
  // The SDK resumes persistent sandboxes by name, so `sandbox_system_id`
  // stores that stable name rather than an opaque SDK id.
  const persistedName = await systemSandboxAccessor.readSandboxId(agentId)
  const desiredName = systemSandboxAccessor.nameFor(agentId)
  let sandbox: Sandbox | null = null

  if (persistedName) {
    try {
      sandbox = await Sandbox.get(
        withVercelSandboxCredentials({ name: persistedName })
      )
    } catch {
      sandbox = null
    }
  }

  let created = false
  if (!sandbox) {
    sandbox = await Sandbox.create(
      withVercelSandboxCredentials({
        ...SYSTEM_SANDBOX_CREATE_OPTIONS,
        name: desiredName,
        tags: systemSandboxTags(agentId),
      })
    )
    created = true
    if (persistedName !== desiredName) {
      await systemSandboxAccessor.writeSandboxId(agentId, desiredName)
    }
  }

  return { sandbox, created }
}

// Returns `null` when the marker file does not exist.
export async function readMarker(
  sandbox: Sandbox,
  path: string
): Promise<string | null> {
  const buf = await sandbox.readFileToBuffer({ path }).catch(() => null)
  return buf ? buf.toString('utf8').trim() : null
}

export async function writeMarker(
  sandbox: Sandbox,
  path: string,
  value: string
): Promise<void> {
  await sandbox.writeFiles([{ path, content: Buffer.from(value, 'utf8') }])
}

// Resume by name. Callers must cross this SDK boundary from inside a `"use
// step"` body.
export async function getSystemSandbox(agentId: string): Promise<Sandbox> {
  return await systemSandboxAccessor.getSandbox(agentId)
}

// Best-effort delete before removing the agent row so we do not leak a
// persistent sandbox.
export async function destroyAgentSandboxes(agentId: string): Promise<void> {
  await destroySkillSandbox(agentId)
  await systemSandboxAccessor.destroySandbox(agentId)
}

const systemSandboxAccessor = createAgentSandboxAccessor({
  field: 'sandboxSystemId',
  missingMessage: (agentId) =>
    `Agent ${agentId} has no system sandbox yet — startupSystemSandbox must run first.`,
  suffix: 'system',
})
