import 'server-only'
import { agentBrowserManifest } from './agent-browser/manifest'
import type { ToolSandboxManifest } from './types'

interface RegistryEntry {
  manifest: ToolSandboxManifest
}

const REGISTRY: Record<string, RegistryEntry> = {
  [agentBrowserManifest.id]: {
    manifest: agentBrowserManifest,
  },
}

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
