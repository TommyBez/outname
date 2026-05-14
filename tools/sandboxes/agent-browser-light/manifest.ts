import { defineSandboxManifest } from '../types'

// Bump `version` whenever the install steps change so older snapshots are
// rebuilt on the next attach.
export const agentBrowserLightManifest = defineSandboxManifest({
  id: 'agent-browser-light',
  displayName: 'agent-browser-light',
  description:
    'Sandbox image with the agent-browser CLI configured to use the Lightpanda engine.',
  version: 1,
  build: {
    runtime: 'node22',
    timeout: 600_000,
  },
})
