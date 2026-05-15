import { formatAgentCadence } from '@/agents/format'
import type { AgentScheduleMode } from '@/shared/agent-schedule'
import type { ModelOption } from '@/shared/server/ai-gateway-models'

export const INTERVAL_OPTIONS = [
  { value: 5, label: formatAgentCadence(5) },
  { value: 15, label: formatAgentCadence(15) },
  { value: 30, label: formatAgentCadence(30) },
  { value: 60, label: formatAgentCadence(60) },
  { value: 180, label: formatAgentCadence(180) },
  { value: 360, label: formatAgentCadence(360) },
  { value: 720, label: formatAgentCadence(720) },
  { value: 1440, label: formatAgentCadence(1440) },
] as const

export const BOOTSTRAP_FILE_OPTIONS = [
  {
    value: 'identity-card',
    label: 'Identity card',
    fileName: 'IDENTITY.md',
  },
  {
    value: 'identity',
    label: 'Persona',
    fileName: 'SOUL.md',
  },
  {
    value: 'instructions',
    label: 'Instructions',
    fileName: 'AGENTS.md',
  },
  {
    value: 'user-profile',
    label: 'User profile',
    fileName: 'USER.md',
  },
] as const

export type BootstrapFileValue =
  (typeof BOOTSTRAP_FILE_OPTIONS)[number]['value']
export type StepLimitMode = 'custom' | 'grind' | 'high' | 'low' | 'medium'

export interface AgentFormInitial {
  dreamingEnabled: boolean
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  heartbeatScheduleMode: AgentScheduleMode
  heartbeatScheduleTimes: string[]
  id: string
  identity: string
  identityCard: string
  instructions: string
  model: string
  name: string
  stepLimitCustom: number | null
  stepLimitMode: StepLimitMode
  userProfile: string
}

export const selectedModelSort =
  (selectedId: string) => (a: ModelOption, b: ModelOption) => {
    if (a.id === selectedId) {
      return -1
    }
    if (b.id === selectedId) {
      return 1
    }
    return 0
  }

export function modelMatchesSearch(option: ModelOption, search: string) {
  const query = search.trim().toLowerCase()
  if (!query) {
    return true
  }
  return [option.name, option.id, option.ownedBy].some((candidate) =>
    candidate.toLowerCase().includes(query)
  )
}

export function uniqueModelsById(options: ModelOption[]) {
  const seen = new Set<string>()
  const unique: ModelOption[] = []
  for (const option of options) {
    if (seen.has(option.id)) {
      continue
    }
    seen.add(option.id)
    unique.push(option)
  }
  return unique
}

export function resolveModelOptions(
  models: ModelOption[],
  defaultModel: string
): ModelOption[] {
  if (models.length > 0) {
    return models
  }
  return [
    {
      contextWindow: 0,
      id: defaultModel,
      name: defaultModel,
      ownedBy: 'gateway',
      inputUsdPerToken: null,
      outputUsdPerToken: null,
    },
  ]
}

export function groupModelsByProvider(
  options: ModelOption[],
  selectedProvider: string | undefined
) {
  const grouped = options.reduce<Record<string, ModelOption[]>>(
    (acc, option) => {
      const key = option.ownedBy
      let group = acc[key]
      if (!group) {
        group = []
        acc[key] = group
      }
      group.push(option)
      return acc
    },
    {}
  )
  const ownedByKeys = Object.keys(grouped).sort((a, b) =>
    compareProviders(a, b, selectedProvider)
  )
  return { grouped, ownedByKeys }
}

function compareProviders(
  a: string,
  b: string,
  selectedProvider: string | undefined
) {
  if (a === selectedProvider) {
    return -1
  }
  if (b === selectedProvider) {
    return 1
  }
  return a.localeCompare(b)
}
