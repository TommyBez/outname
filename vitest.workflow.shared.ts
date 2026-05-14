import { fileURLToPath } from 'node:url'

export const workflowTestRoot = fileURLToPath(new URL('./', import.meta.url))
export const workflowFixtureRoot = fileURLToPath(
  new URL('./test/workflow-fixtures', import.meta.url)
)

export const workflowTestAlias = {
  '@': workflowTestRoot,
} as const
