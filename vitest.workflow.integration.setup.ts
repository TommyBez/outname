import { setupWorkflowTests, teardownWorkflowTests } from '@workflow/vitest'
import { afterAll } from 'vitest'
import { workflowFixtureRoot } from './vitest.workflow.shared'

await setupWorkflowTests({
  cwd: workflowFixtureRoot,
})

afterAll(async () => {
  await teardownWorkflowTests()
})
