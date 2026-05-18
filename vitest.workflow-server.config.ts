import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { workflow } from 'workflow/vite'
import { workflowServerAppRoot } from './vitest.workflow.shared'

const WORKFLOW_SERVER_BASE_URL = 'http://127.0.0.1:4010'
const workflowServerSetupPath = fileURLToPath(
  new URL('./vitest.workflow-server.setup.ts', import.meta.url)
)

export default defineConfig({
  plugins: [workflow()],
  root: workflowServerAppRoot,
  test: {
    clearMocks: true,
    environment: 'node',
    env: {
      WORKFLOW_LOCAL_BASE_URL: WORKFLOW_SERVER_BASE_URL,
      WORKFLOW_TARGET_WORLD: 'local',
    },
    globalSetup: workflowServerSetupPath,
    include: ['**/*.workflow.server.test.ts'],
    mockReset: true,
    restoreMocks: true,
    testTimeout: 60_000,
  },
})
