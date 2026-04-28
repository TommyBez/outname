import { AppShell } from "@/components/app-shell"
import { AgentForm } from "@/components/agent-form"
import { DEFAULT_MODEL_ID, getAvailableModels } from "@/lib/ai-gateway-models"

// Cache Components is enabled in next.config, so a route-level
// `dynamic = "force-dynamic"` is forbidden. The model catalog is
// served from `unstable_cache` inside `getAvailableModels`, which
// shares the AI gateway request across visitors; the page itself
// just renders on demand under Cache Components defaults.
export default async function NewAgentPage() {
  const models = await getAvailableModels()

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

      <AgentForm models={models} defaultModel={DEFAULT_MODEL_ID} />
    </AppShell>
  )
}
