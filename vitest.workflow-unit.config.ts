import { defineConfig } from 'vitest/config'
import { workflowTestAlias } from './vitest.workflow.shared'

export default defineConfig({
  resolve: {
    alias: workflowTestAlias,
  },
  test: {
    clearMocks: true,
    environment: 'node',
    include: ['**/*.step.unit.test.ts', '**/*.workflow.unit.test.ts'],
    mockReset: true,
    restoreMocks: true,
  },
})
