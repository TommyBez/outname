import { fileURLToPath } from 'node:url'

export const workflowTestRoot = fileURLToPath(new URL('./', import.meta.url))
export const workflowFixtureRoot = fileURLToPath(
  new URL('./test/workflow-fixtures', import.meta.url)
)
export const workflowServerAppRoot = fileURLToPath(
  new URL('./test/workflow-server-app', import.meta.url)
)

export const workflowTestAlias = {
  '@outname/ai': fileURLToPath(new URL('./packages/ai', import.meta.url)),
  '@outname/auth': fileURLToPath(new URL('./packages/auth', import.meta.url)),
  '@outname/db': fileURLToPath(new URL('./packages/db', import.meta.url)),
  '@outname/email': fileURLToPath(new URL('./packages/email', import.meta.url)),
  '@outname/shared': fileURLToPath(
    new URL('./packages/shared', import.meta.url)
  ),
  '@outname/ui': fileURLToPath(new URL('./packages/ui', import.meta.url)),
  '@outname/workflow': fileURLToPath(
    new URL('./packages/workflow', import.meta.url)
  ),
} as const
