import type { AgentBudgetValues } from '@/agents/components/agent-budget-widget'
import type { AgentScheduleMode } from '@/shared/agent-schedule'

export interface AgentEditChatProps {
  agentId: string
  currentBudget: AgentBudgetValues
  currentMarkdownFiles: AgentEditMarkdownFiles
  currentSettings: AgentEditSettings
}

export interface AgentEditMarkdownFiles {
  identityCard: string
  instructions: string
  soul: string
  userProfile: string
}

export interface AgentEditSettings {
  dreamingEnabled: boolean
  dreamingIntervalMinutes: number
  dreamingScheduleMode: AgentScheduleMode
  dreamingScheduleTimes: string[]
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  heartbeatScheduleMode: AgentScheduleMode
  heartbeatScheduleTimes: string[]
  model: string
  name: string
  stepLimitCustom: null | number
  stepLimitMode: 'custom' | 'grind' | 'high' | 'low' | 'medium'
}

export const MARKDOWN_FILE_FIELDS = [
  { key: 'identityCard', path: 'IDENTITY.md', title: 'Identity card' },
  { key: 'soul', path: 'SOUL.md', title: 'Soul' },
  { key: 'instructions', path: 'AGENTS.md', title: 'Instructions' },
  { key: 'userProfile', path: 'USER.md', title: 'User profile' },
] as const

export type MarkdownFileKey = (typeof MARKDOWN_FILE_FIELDS)[number]['key']

export const SETTINGS_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'model', label: 'Model' },
  { key: 'heartbeatEnabled', label: 'Heartbeat' },
  { key: 'heartbeatScheduleMode', label: 'Heartbeat schedule mode' },
  { key: 'heartbeatScheduleTimes', label: 'Heartbeat times' },
  { key: 'heartbeatIntervalMinutes', label: 'Heartbeat interval' },
  { key: 'dreamingEnabled', label: 'Dreaming' },
  { key: 'dreamingScheduleMode', label: 'Dreaming schedule mode' },
  { key: 'dreamingScheduleTimes', label: 'Dreaming times' },
  { key: 'dreamingIntervalMinutes', label: 'Dreaming interval' },
  { key: 'stepLimitMode', label: 'Step limit' },
  { key: 'stepLimitCustom', label: 'Custom step limit' },
] as const

export type SettingsKey = (typeof SETTINGS_FIELDS)[number]['key']

export interface MarkdownChange {
  addedLineCount: number
  current: string
  path: string
  proposed: string
  removedLineCount: number
  title: string
}

export interface DiffLine {
  count?: number
  id: string
  kind: 'added' | 'context' | 'omitted' | 'removed'
  text: string
}

export type RawDiffLine = Omit<DiffLine, 'id'>

export interface SettingsChange {
  current: string
  label: string
  proposed: string
}

export type SendMessageFn = (input: {
  text: string
}) => void | PromiseLike<void>
