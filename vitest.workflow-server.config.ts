import { defineConfig } from 'vitest/config'
import { workflow } from 'workflow/vite'
import { workflowTestAlias } from './vitest.workflow.shared'

const WORKFLOW_SERVER_BASE_URL = 'http://127.0.0.1:4010'

export default defineConfig({
  plugins: [workflow()],
  resolve: {
    alias: workflowTestAlias,
  },
  test: {
    clearMocks: true,
    environment: 'node',
    env: {
      WORKFLOW_LOCAL_BASE_URL: WORKFLOW_SERVER_BASE_URL,
      WORKFLOW_TARGET_WORLD: 'local',
    },
    globalSetup: './vitest.workflow-server.setup.ts',
    include: ['**/*.workflow.server.test.ts'],
    mockReset: true,
    restoreMocks: true,
    testTimeout: 60_000,
  },
})
