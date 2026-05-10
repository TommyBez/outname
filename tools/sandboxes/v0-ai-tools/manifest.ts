import { defineSandboxManifest } from '../types'

/**
 * Sandbox manifest for the `v0_ai_tools` maintainer tool.
 *
 * The setup script installs the official `@v0-sdk/ai-tools` package and
 * writes a tiny runner that dispatches to the published AI SDK tools.
 */
export const v0AiToolsManifest = defineSandboxManifest({
  id: 'v0-ai-tools',
  displayName: 'v0 AI Tools',
  description:
    'Sandbox image with the official @v0-sdk/ai-tools package installed for authenticated v0 Platform API access.',
  version: 1,
  build: {
    runtime: 'node22',
    timeout: 600_000,
  },
  runtimeNetwork: {
    brokeredProviders: ['v0'],
  },
})
