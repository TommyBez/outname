import 'server-only'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { agentBrowserManifest } from './agent-browser/manifest'
import type { ToolSandboxManifest } from './types'

/**
 * Tool-sandbox manifest registry.
 *
 * Each entry pairs a manifest descriptor with the path to the `setup.sh`
 * that bootstraps a sandbox for that manifest. The script bytes are
 * loaded lazily (and cached) so attach-time hash checks are cheap and
 * the workflow build step has the script to run.
 */
interface RegistryEntry {
  manifest: ToolSandboxManifest
  setupScriptPath: string
}

const REGISTRY: Record<string, RegistryEntry> = {
  [agentBrowserManifest.id]: {
    manifest: agentBrowserManifest,
    setupScriptPath: join(
      process.cwd(),
      'tools/sandboxes/agent-browser/setup.sh'
    ),
  },
}

const setupScriptCache = new Map<string, string>()
const manifestHashCache = new Map<string, string>()

function entryFor(manifestId: string): RegistryEntry {
  const entry = REGISTRY[manifestId]
  if (!entry) {
    throw new Error(`Unknown tool sandbox manifest: ${manifestId}`)
  }
  return entry
}

export function getToolSandboxManifest(
  manifestId: string
): ToolSandboxManifest {
  return entryFor(manifestId).manifest
}

export function listToolSandboxManifests(): ToolSandboxManifest[] {
  return Object.values(REGISTRY).map((e) => e.manifest)
}

/**
 * Read the manifest's `setup.sh` from disk as a UTF-8 string. Cached so
 * the attach-time hash check doesn't re-stat once per render.
 */
export function manifestSetupScript(manifestId: string): string {
  const cached = setupScriptCache.get(manifestId)
  if (cached !== undefined) {
    return cached
  }
  const entry = entryFor(manifestId)
  const bytes = readFileSync(entry.setupScriptPath, 'utf8')
  setupScriptCache.set(manifestId, bytes)
  return bytes
}

/**
 * Stable hash that drives rebuilds. Combines the manifest's `version`
 * field with the bytes of its `setup.sh` so either changing knob —
 * bumping `version` or editing the script — invalidates the snapshot
 * on the next attach.
 */
export function manifestHash(manifestId: string): string {
  const cached = manifestHashCache.get(manifestId)
  if (cached !== undefined) {
    return cached
  }
  const m = entryFor(manifestId).manifest
  const script = manifestSetupScript(manifestId)
  const hash = createHash('sha256')
    .update(`v${m.version}\n`)
    .update(script)
    .digest('hex')
  manifestHashCache.set(manifestId, hash)
  return hash
}
