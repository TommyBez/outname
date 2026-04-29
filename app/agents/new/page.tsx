import { AgentForm } from '@/components/agent-form'
import { AppShell } from '@/components/app-shell'
import { DEFAULT_MODEL_ID, getAvailableModels } from '@/lib/ai-gateway-models'

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
        <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">
          New agent
        </p>
        <h1 className="font-medium font-serif text-4xl leading-tight tracking-tight md:text-5xl">
          Configure a new agent.
        </h1>
      </header>

      <AgentForm defaultModel={DEFAULT_MODEL_ID} models={models} />
    </AppShell>
  )
}
