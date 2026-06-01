import {
  emitActivity,
  emitRun,
  emitStep,
} from '@outname/ai/agent-runtime/server/run-events'
import type { StepResult, ToolSet, UIMessage } from 'ai'
import {
  buildStepLimitNotice,
  didReachStepLimit,
  type resolveStepLimit,
  resolveStepLimitCount,
} from '../../step-limit'
import {
  formatStepLimitStreamText,
  writeAssistantNotice,
} from './stream-control'

type StepLimitInput = Parameters<typeof resolveStepLimit>[0]

interface InvocationStreamResult {
  steps: readonly StepResult<ToolSet>[]
  uiMessages?: UIMessage[]
}

export async function finishSuccessfulInvocation(input: {
  result: InvocationStreamResult
  runId: string
  stepLimitInput: StepLimitInput
  streamNamespace: string
  streamNamespaces?: readonly string[]
}): Promise<void> {
  const { result, runId, stepLimitInput } = input
  const streamNamespaces = input.streamNamespaces ?? [input.streamNamespace]
  const hitStepLimit = didReachStepLimit({
    ...stepLimitInput,
    steps: result.steps,
  })
  if (hitStepLimit) {
    await emitActivity(
      runId,
      'Sub-agent: Step limit reached, finalizing early',
      {
        stepLimit: resolveStepLimitCount(stepLimitInput),
      }
    )
  }
  await emitStep(
    runId,
    'read',
    'done',
    hitStepLimit
      ? 'Sub-agent instruction reached the step limit'
      : 'Sub-agent instruction completed'
  )

  if (hitStepLimit) {
    await Promise.all(
      streamNamespaces.map((namespace) =>
        writeAssistantNotice(
          namespace,
          formatStepLimitStreamText(
            result.uiMessages ?? [],
            buildStepLimitNotice(stepLimitInput)
          )
        )
      )
    )
  }
  await emitActivity(runId, 'Sub-agent: Finalizing reply')
  await emitRun(
    runId,
    'completed',
    hitStepLimit
      ? 'Sub-agent run completed after reaching the step limit'
      : 'Sub-agent run completed'
  )
}
