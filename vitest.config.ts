import { defineConfig } from 'vitest/config'
import { workflowTestAlias } from './vitest.workflow.shared'

export default defineConfig({
  resolve: {
    alias: workflowTestAlias,
  },
  test: {
    clearMocks: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      '**/*.workflow.integration.test.ts',
      '**/*.workflow.server.test.ts',
      '**/*.workflow.unit.test.ts',
      '**/*.step.unit.test.ts',
    ],
    include: ['**/*.test.ts'],
    mockReset: true,
    restoreMocks: true,
  },
})
