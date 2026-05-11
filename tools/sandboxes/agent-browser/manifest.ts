import { defineSandboxManifest } from '../types'

// Bump `version` whenever the install steps change so older snapshots are
// rebuilt on the next attach.
export const agentBrowserManifest = defineSandboxManifest({
  id: 'agent-browser',
  displayName: 'agent-browser',
  description:
    'Sandbox image with the agent-browser CLI and its Chromium dependencies pre-installed.',
  version: 1,
  build: {
    runtime: 'node22',
    timeout: 600_000,
  },
})
