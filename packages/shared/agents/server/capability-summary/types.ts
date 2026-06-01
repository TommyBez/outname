export const SUMMARY_BOOTSTRAP_PATH = 'AGENTS.md'

export type BootstrapContent = Partial<
  Record<typeof SUMMARY_BOOTSTRAP_PATH, string>
>

export interface AttachedCapability {
  description: string
  name: string
}

export interface SummaryContext {
  agentsMd: string
  attached: AttachedCapability[]
  name: string
  previousSummary: string | null
  userId: string
}
