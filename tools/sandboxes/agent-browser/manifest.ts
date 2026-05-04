import { defineSandboxManifest } from '../types'

/**
 * `agent-browser` tool sandbox manifest.
 *
 * The matching `setup.sh` (loaded as a string by the build runtime)
 * installs Chromium's system libraries via `dnf`, the `agent-browser`
 * CLI globally via npm, and runs `agent-browser install` to fetch the
 * Chromium binary into the snapshot.
 *
 * Bump `version` when changing the install steps (dep set or pinned
 * version) so existing snapshots are invalidated.
 */
export const agentBrowserManifest = defineSandboxManifest({
  id: 'agent-browser',
  displayName: 'agent-browser',
  description:
    'Sandbox image with the agent-browser CLI and its Chromium dependencies pre-installed.',
  setupScript: 'tools/sandboxes/agent-browser/setup.sh',
  version: 1,
  build: {
    runtime: 'node22',
    timeout: 600_000,
  },
})
