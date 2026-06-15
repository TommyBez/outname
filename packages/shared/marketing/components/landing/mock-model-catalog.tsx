import {
  Panel,
  StatusTag,
} from '@outname/shared/marketing/components/landing/mock-kit'
import { SwissLabel } from '@outname/shared/marketing/components/landing/section-kit'
import { cn } from '@outname/ui/lib/utils'

const GATEWAYS = [
  { name: 'Vercel AI Gateway', key: false },
  { name: 'OpenRouter', key: true },
  { name: 'LLM Gateway', key: false },
] as const

const CATALOG = [
  { provider: 'Anthropic', models: 'Opus · Sonnet · Haiku' },
  { provider: 'OpenAI', models: 'GPT-5 · o-series' },
  { provider: 'Google', models: 'Gemini 2.5' },
  { provider: 'DeepSeek', models: 'V3 · R1' },
  { provider: 'Moonshot', models: 'Kimi K2' },
  { provider: 'Meta', models: 'Llama 4' },
] as const

/** Illustrative gateway → provider → model catalog. */
export function MockModelCatalog() {
  return (
    <Panel
      status={<StatusTag tone="accent">1 key set</StatusTag>}
      title="inference"
    >
      <div className="px-4 py-4">
        <SwissLabel className="text-muted-foreground">
          Gateways — set a key
        </SwissLabel>
        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {GATEWAYS.map((gateway) => (
            <div
              className={cn(
                'flex items-center justify-between gap-2 border-2 px-3 py-2.5 font-mono text-xs',
                gateway.key ? 'border-foreground' : 'border-border'
              )}
              key={gateway.name}
            >
              <span
                className={gateway.key ? 'font-bold' : 'text-muted-foreground'}
              >
                {gateway.name}
              </span>
              {gateway.key ? (
                <StatusTag tone="accent">key</StatusTag>
              ) : (
                <span className="text-muted-foreground">+ key</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-foreground border-y-2 bg-secondary px-4 py-2 text-center font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.16em]">
        ↓ one key unlocks every model the gateway serves
      </div>

      <div className="px-4 py-4">
        <SwissLabel className="text-muted-foreground">
          Models — pick any
        </SwissLabel>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATALOG.map((entry) => (
            <div
              className="border-2 border-border px-3 py-2.5"
              key={entry.provider}
            >
              <div className="font-bold font-mono text-xs">
                {entry.provider}
              </div>
              <div className="mt-1 font-mono text-[0.6875rem] text-muted-foreground">
                {entry.models}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}
