import type { AgentKind } from "@/lib/db/schema"

/**
 * Static metadata for each agent kind. The runtime workflow function is
 * imported lazily by the trigger/cron routes so this file stays safe to
 * import from Server Components.
 */
export interface AgentKindDefinition {
  kind: AgentKind
  label: string
  description: string
  defaultName: string
}

export const AGENT_KINDS: Record<AgentKind, AgentKindDefinition> = {
  "daily-email-brief": {
    kind: "daily-email-brief",
    label: "Daily email brief",
    description:
      "Scans your inbox, classifies new messages, and produces a markdown digest on demand.",
    defaultName: "Daily email brief",
  },
}

export const AGENT_KIND_LIST: AgentKindDefinition[] = Object.values(AGENT_KINDS)

export function isAgentKind(value: string): value is AgentKind {
  return value in AGENT_KINDS
}
