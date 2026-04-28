import { AppShell } from "@/components/app-shell"
import { AgentForm } from "@/components/agent-form"
import { DEFAULT_MODEL_ID, getAvailableModels } from "@/lib/ai-gateway-models"

// `getAvailableModels` is internally `revalidate: 3600`, so the
// gateway hit is shared across all visitors and only every page
// render pays the React cost.
export const dynamic = "force-dynamic"

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
