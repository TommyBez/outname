import type { InferenceProvider } from '@outname/db/schema'
import type { AgentScheduleMode } from '@outname/shared/agent-schedule'
import type {
  AgentFormInitial,
  BootstrapFileValue,
  StepLimitMode,
} from './options'

export interface AgentFormState {
  activeBootstrapFile: BootstrapFileValue
  dreamingEnabled: boolean
  heartbeatEnabled: boolean
  heartbeatScheduleMode: AgentScheduleMode
  heartbeatScheduleTimes: string[]
  identity: string
  identityCard: string
  inferenceProvider: InferenceProvider
  instructions: string
  intervalMinutes: number
  model: string
  name: string
  stepLimitCustom: number
  stepLimitMode: StepLimitMode
  userProfile: string
}

export type AgentFormAction =
  | { type: 'set_name'; value: string }
  | { type: 'set_identity_card'; value: string }
  | { type: 'set_identity'; value: string }
  | { type: 'set_instructions'; value: string }
  | { type: 'set_user_profile'; value: string }
  | { type: 'set_active_bootstrap_file'; value: BootstrapFileValue }
  | { type: 'set_inference_provider'; value: InferenceProvider }
  | { type: 'set_model'; value: string }
  | { type: 'set_heartbeat_enabled'; value: boolean }
  | { type: 'set_heartbeat_schedule_mode'; value: AgentScheduleMode }
  | { type: 'set_heartbeat_schedule_times'; value: string[] }
  | { type: 'set_interval_minutes'; value: number }
  | { type: 'set_dreaming_enabled'; value: boolean }
  | { type: 'set_step_limit_mode'; value: StepLimitMode }
  | { type: 'set_step_limit_custom'; value: number }

export function createAgentFormState(input: {
  defaultInferenceProvider: InferenceProvider
  defaultModel: string
  initial?: AgentFormInitial
}): AgentFormState {
  return {
    name: input.initial?.name ?? '',
    identityCard: input.initial?.identityCard ?? '',
    identity: input.initial?.identity ?? '',
    instructions: input.initial?.instructions ?? '',
    userProfile: input.initial?.userProfile ?? '',
    activeBootstrapFile: 'identity-card',
    inferenceProvider:
      input.initial?.inferenceProvider ?? input.defaultInferenceProvider,
    model: input.initial?.model ?? input.defaultModel,
    heartbeatEnabled: input.initial?.heartbeatEnabled ?? true,
    heartbeatScheduleMode: input.initial?.heartbeatScheduleMode ?? 'interval',
    heartbeatScheduleTimes: input.initial?.heartbeatScheduleTimes ?? [],
    intervalMinutes: input.initial?.heartbeatIntervalMinutes ?? 30,
    dreamingEnabled: input.initial?.dreamingEnabled ?? true,
    stepLimitMode: input.initial?.stepLimitMode ?? 'medium',
    stepLimitCustom: input.initial?.stepLimitCustom ?? 30,
  }
}

/**
 * True when the operator changed anything that would be persisted on save.
 * `activeBootstrapFile` is pure view state, so it is excluded.
 */
export function isAgentFormDirty(
  state: AgentFormState,
  initial: AgentFormState
): boolean {
  return (
    state.name !== initial.name ||
    state.identityCard !== initial.identityCard ||
    state.identity !== initial.identity ||
    state.instructions !== initial.instructions ||
    state.userProfile !== initial.userProfile ||
    state.inferenceProvider !== initial.inferenceProvider ||
    state.model !== initial.model ||
    state.heartbeatEnabled !== initial.heartbeatEnabled ||
    state.heartbeatScheduleMode !== initial.heartbeatScheduleMode ||
    state.heartbeatScheduleTimes.join(',') !==
      initial.heartbeatScheduleTimes.join(',') ||
    state.intervalMinutes !== initial.intervalMinutes ||
    state.dreamingEnabled !== initial.dreamingEnabled ||
    state.stepLimitMode !== initial.stepLimitMode ||
    state.stepLimitCustom !== initial.stepLimitCustom
  )
}

export function agentFormReducer(
  state: AgentFormState,
  action: AgentFormAction
): AgentFormState {
  switch (action.type) {
    case 'set_name':
      return { ...state, name: action.value }
    case 'set_identity_card':
      return { ...state, identityCard: action.value }
    case 'set_identity':
      return { ...state, identity: action.value }
    case 'set_instructions':
      return { ...state, instructions: action.value }
    case 'set_user_profile':
      return { ...state, userProfile: action.value }
    case 'set_active_bootstrap_file':
      return { ...state, activeBootstrapFile: action.value }
    case 'set_inference_provider':
      return { ...state, inferenceProvider: action.value }
    case 'set_model':
      return { ...state, model: action.value }
    case 'set_heartbeat_enabled':
      return { ...state, heartbeatEnabled: action.value }
    case 'set_heartbeat_schedule_mode':
      return { ...state, heartbeatScheduleMode: action.value }
    case 'set_heartbeat_schedule_times':
      return { ...state, heartbeatScheduleTimes: action.value }
    case 'set_interval_minutes':
      return { ...state, intervalMinutes: action.value }
    case 'set_dreaming_enabled':
      return { ...state, dreamingEnabled: action.value }
    case 'set_step_limit_mode':
      return { ...state, stepLimitMode: action.value }
    case 'set_step_limit_custom':
      return { ...state, stepLimitCustom: action.value }
    default:
      return state
  }
}
