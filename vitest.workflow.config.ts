import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { workflowTransformPlugin } from '@workflow/rollup'
import { defineConfig } from 'vitest/config'
import {
  workflowFixtureRoot,
  workflowTestAlias,
} from './vitest.workflow.shared'

const integrationGlobalSetupPath = fileURLToPath(
  new URL('./vitest.workflow.integration.global-setup.ts', import.meta.url)
)
const integrationSetupPath = fileURLToPath(
  new URL('./vitest.workflow.integration.setup.ts', import.meta.url)
)

export default defineConfig({
  plugins: [
    workflowTransformPlugin({
      exclude: [`${join(workflowFixtureRoot, '.workflow-vitest')}/`],
    }),
  ],
  root: workflowFixtureRoot,
  resolve: {
    alias: workflowTestAlias,
  },
  test: {
    clearMocks: true,
    environment: 'node',
    globalSetup: integrationGlobalSetupPath,
    include: ['**/*.workflow.integration.test.ts'],
    mockReset: true,
    restoreMocks: true,
    setupFiles: [integrationSetupPath],
    testTimeout: 60_000,
  },
})
