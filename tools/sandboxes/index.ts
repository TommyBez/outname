import 'server-only'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
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
}

const REGISTRY: Record<string, RegistryEntry> = {
  [agentBrowserManifest.id]: {
    manifest: agentBrowserManifest,
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
  const bytes = readFileSync(setupScriptPathFor(entry.manifest.id), 'utf8')
  setupScriptCache.set(manifestId, bytes)
  return bytes
}

function setupScriptPathFor(manifestId: string): string {
  if (manifestId === agentBrowserManifest.id) {
    return path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      'tools',
      'sandboxes',
      'agent-browser',
      'setup.sh'
    )
  }
  throw new Error(`Unknown tool sandbox manifest: ${manifestId}`)
}

/**
 * Stable hash that drives rebuilds. Combines the manifest descriptor
 * with the bytes of its `setup.sh` so changing runtime/resources,
 * version, or the install script invalidates the snapshot on the next
 * attach.
 */
export function manifestHash(manifestId: string): string {
  const cached = manifestHashCache.get(manifestId)
  if (cached !== undefined) {
    return cached
  }
  const m = entryFor(manifestId).manifest
  const script = manifestSetupScript(manifestId)
  const hash = createHash('sha256')
    .update(stableStringify(m))
    .update('\n')
    .update(script)
    .digest('hex')
  manifestHashCache.set(manifestId, hash)
  return hash
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}
