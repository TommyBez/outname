import { stepCountIs } from 'ai'

type StepLimitMode = 'custom' | 'grind' | 'high' | 'low' | 'medium'

export function resolveStepLimit(input: {
  custom: number | null
  mode: StepLimitMode
}): ReturnType<typeof stepCountIs> | undefined {
  if (input.mode === 'grind') {
    return
  }
  if (input.mode === 'low') {
    return stepCountIs(10)
  }
  if (input.mode === 'high') {
    return stepCountIs(50)
  }
  if (input.mode === 'custom') {
    return stepCountIs(Math.max(1, Math.floor(input.custom ?? 30)))
  }
  return stepCountIs(30)
}
