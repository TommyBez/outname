import 'server-only'
import { createHash } from 'node:crypto'
import {
  getToolSandboxManifest as readToolSandboxManifest,
  listToolSandboxManifests as readToolSandboxManifests,
  getToolSandboxSetupScript as readToolSandboxSetupScript,
} from './registry'

/**
 * Tool-sandbox manifest registry.
 *
 * Each entry pairs a manifest descriptor with the bundled setup script
 * that bootstraps a sandbox for that manifest. The script bytes are
 * loaded lazily (and cached) so attach-time hash checks are cheap and
 * the workflow build step has the script to run, without relying on
 * runtime FS access inside a deployed function bundle.
 */
const setupScriptCache = new Map<string, string>()
const manifestHashCache = new Map<string, string>()

export function getToolSandboxManifest(manifestId: string) {
  return readToolSandboxManifest(manifestId)
}

export function listToolSandboxManifests() {
  return readToolSandboxManifests()
}

/**
 * Read the manifest's setup script from the registry. Cached so the
 * attach-time hash check doesn't rebuild the string once per render.
 */
export function manifestSetupScript(manifestId: string): string {
  const cached = setupScriptCache.get(manifestId)
  if (cached !== undefined) {
    return cached
  }
  const bytes = readToolSandboxSetupScript(manifestId)
  setupScriptCache.set(manifestId, bytes)
  return bytes
}

/**
 * Stable hash that drives rebuilds. Combines the manifest descriptor
 * with the bytes of its setup script so changing runtime/resources,
 * version, or the install script invalidates the snapshot on the next
 * attach.
 */
export function manifestHash(manifestId: string): string {
  const cached = manifestHashCache.get(manifestId)
  if (cached !== undefined) {
    return cached
  }
  const m = readToolSandboxManifest(manifestId)
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
