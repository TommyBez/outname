import 'server-only'
import { createHash } from 'node:crypto'
import {
  getToolSandboxManifest as readToolSandboxManifest,
  listToolSandboxManifests as readToolSandboxManifests,
  getToolSandboxSetupScript as readToolSandboxSetupScript,
} from './registry'

const setupScriptCache = new Map<string, string>()
const manifestHashCache = new Map<string, string>()

export function getToolSandboxManifest(manifestId: string) {
  return readToolSandboxManifest(manifestId)
}

export function listToolSandboxManifests() {
  return readToolSandboxManifests()
}

// Cache setup-script bytes so attach-time hash checks stay cheap.
export function manifestSetupScript(manifestId: string): string {
  const cached = setupScriptCache.get(manifestId)
  if (cached !== undefined) {
    return cached
  }
  const bytes = readToolSandboxSetupScript(manifestId)
  setupScriptCache.set(manifestId, bytes)
  return bytes
}

// Include both descriptor and setup-script bytes so any manifest drift
// invalidates the cached snapshot on the next attach.
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
