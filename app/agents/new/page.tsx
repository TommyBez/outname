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
      <header className="mb-12 border-foreground border-t-4 pt-6">
        <p className="swiss-label mb-4 text-accent">03. New agent</p>
        <h1 className="max-w-4xl font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter md:text-7xl">
          Configure a new agent
        </h1>
      </header>

      <section className="border-foreground border-t-2 pt-8">
        <AgentForm defaultModel={DEFAULT_MODEL_ID} models={models} />
      </section>
    </AppShell>
  )
}
