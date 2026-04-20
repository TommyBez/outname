import { AppShell } from "@/components/app-shell"
import { AGENT_KIND_LIST } from "@/workflows/agents/registry"
import { AgentForm } from "@/components/agent-form"
import { createAgentAction } from "@/lib/agent-actions"

export default function NewAgentPage() {
  return (
    <AppShell>
      <header className="mb-10 flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          New agent
        </p>
        <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
          Configure a new agent.
        </h1>
      </header>

      <AgentForm
        action={createAgentAction}
        kinds={AGENT_KIND_LIST}
        mode="create"
      />
    </AppShell>
  )
}
