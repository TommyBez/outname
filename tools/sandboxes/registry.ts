import 'server-only'
import { agentBrowserManifest } from './agent-browser/manifest'
import { agentBrowserSetupScript } from './agent-browser/setup'
import { agentBrowserLightManifest } from './agent-browser-light/manifest'
import { agentBrowserLightSetupScript } from './agent-browser-light/setup'
import { githubRepoManifest } from './github-repo/manifest'
import { githubRepoSetupScript } from './github-repo/setup'
import type { ToolSandboxManifest } from './types'

interface RegistryEntry {
  manifest: ToolSandboxManifest
  setupScript: string
}

const REGISTRY: Record<string, RegistryEntry> = {
  [agentBrowserManifest.id]: {
    manifest: agentBrowserManifest,
    setupScript: agentBrowserSetupScript,
  },
  [agentBrowserLightManifest.id]: {
    manifest: agentBrowserLightManifest,
    setupScript: agentBrowserLightSetupScript,
  },
  [githubRepoManifest.id]: {
    manifest: githubRepoManifest,
    setupScript: githubRepoSetupScript,
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

export function getToolSandboxSetupScript(manifestId: string): string {
  return entryFor(manifestId).setupScript
}

export function listToolSandboxManifests(): ToolSandboxManifest[] {
  return Object.values(REGISTRY).map((e) => e.manifest)
}
