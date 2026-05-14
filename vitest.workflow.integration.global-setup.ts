import { buildWorkflowTests } from '@workflow/vitest'
import { workflowFixtureRoot } from './vitest.workflow.shared'

export async function setup(): Promise<void> {
  await buildWorkflowTests({
    cwd: workflowFixtureRoot,
  })
}
