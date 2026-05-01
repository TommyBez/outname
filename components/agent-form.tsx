'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { createAgentAction, updateAgentAction } from '@/lib/agent-actions'
import type { ModelOption } from '@/lib/ai-gateway-models'

// Heartbeat interval is stored as minutes; a small allowlist keeps the
// UI predictable and the ticker math obvious. Phase 3 may move this
// onto a per-trigger row.
const INTERVAL_OPTIONS = [
  { value: 5, label: 'Every 5 minutes' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 180, label: 'Every 3 hours' },
  { value: 360, label: 'Every 6 hours' },
  { value: 720, label: 'Every 12 hours' },
  { value: 1440, label: 'Every day' },
] as const

interface AgentFormProps {
  defaultModel: string
  /**
   * Empty = create form, populated = edit form. `enabled` mirrors
   * `agent.enabled` and stays unchanged by this form — toggle it
   * from the overview page.
   *
   * `identity` and `instructions` are pre-filled from the most
   * recent `pending_file_writes` row for SOUL.md / AGENTS.md (the
   * UI's source of truth for what's effectively on disk). The
   * caller should pass empty strings on a brand-new agent — the
   * form treats those as "show the placeholders" and doesn't
   * enqueue a write unless the operator actually types something.
   */
  initial?: {
    id: string
    name: string
    identity: string
    instructions: string
    model: string
    heartbeatEnabled: boolean
    heartbeatIntervalMinutes: number
    reflectionEnabled: boolean
    reflectionIntervalMinutes: number
  }
  models: ModelOption[]
}

export function AgentForm({ models, defaultModel, initial }: AgentFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState(initial?.name ?? '')
  const [identity, setIdentity] = useState(initial?.identity ?? '')
  const [instructions, setInstructions] = useState(initial?.instructions ?? '')
  // Default model falls back to the gateway's first id if our preferred
  // default isn't in the filtered list. Empty list (fallback mode) is
  // handled by rendering a single passthrough option.
  const [model, setModel] = useState(initial?.model ?? defaultModel)
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(
    initial?.heartbeatEnabled ?? true
  )
  const [intervalMinutes, setIntervalMinutes] = useState(
    initial?.heartbeatIntervalMinutes ?? 30
  )
  const [reflectionEnabled, setReflectionEnabled] = useState(
    initial?.reflectionEnabled ?? true
  )
  const [reflectionIntervalMinutes, setReflectionIntervalMinutes] = useState(
    initial?.reflectionIntervalMinutes ?? 1440
  )

  const isEdit = Boolean(initial?.id)
  const submitLabel = isEdit ? 'Save changes' : 'Create agent'

  // Group models by `ownedBy` so the <select> is browseable. Order is
  // alphabetical within each group; the gateway already returned them
  // sorted that way but we don't rely on it here.
  const grouped = models.reduce<Record<string, ModelOption[]>>((acc, m) => {
    const key = m.ownedBy
    let group = acc[key]
    if (!group) {
      group = []
      acc[key] = group
    }
    group.push(m)
    return acc
  }, {})
  const ownedByKeys = Object.keys(grouped).sort()

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Name is required')
      return
    }
    startTransition(async () => {
      try {
        if (isEdit && initial) {
          await updateAgentAction({
            id: initial.id,
            name: trimmed,
            identity,
            identityOriginal: initial.identity,
            instructions,
            instructionsOriginal: initial.instructions,
            model,
            heartbeatEnabled,
            heartbeatIntervalMinutes: intervalMinutes,
            reflectionEnabled,
            reflectionIntervalMinutes,
          })
          toast.success('Agent updated')
          router.refresh()
        } else {
          const result = await createAgentAction({
            name: trimmed,
            identity,
            instructions,
            model,
            heartbeatEnabled,
            heartbeatIntervalMinutes: intervalMinutes,
            reflectionEnabled,
            reflectionIntervalMinutes,
          })
          toast.success('Agent created')
          router.push(`/agents/${result.id}`)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save agent')
      }
    })
  }

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
      <div className="grid gap-3 border-foreground border-b-2 pb-8 md:grid-cols-[12rem_minmax(0,1fr)]">
        <Label htmlFor="agent-name">Name</Label>
        <div className="flex flex-col gap-2">
          <Input
            id="agent-name"
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="Research Buddy"
            required
            value={name}
          />
          <p className="text-muted-foreground text-xs">
            Shown in the sidebar and at the top of every chat.
          </p>
        </div>
      </div>

      <div className="grid gap-3 border-foreground border-b-2 pb-8 md:grid-cols-[12rem_minmax(0,1fr)]">
        <div>
          <Label>Persona files</Label>
        </div>
        <div>
          <p className="mb-4 max-w-2xl text-muted-foreground text-xs leading-relaxed">
            {
              "These two files are inlined verbatim into the agent's system prompt on every event. They live in the agent's memory volume — the agent can read them via read_memory but its tools refuse to write or delete them. Save here flushes to disk on the next event."
            }
          </p>
          <Tabs className="mt-1" defaultValue="identity">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="identity">Identity (SOUL.md)</TabsTrigger>
              <TabsTrigger value="instructions">
                Instructions (AGENTS.md)
              </TabsTrigger>
            </TabsList>
            <TabsContent className="mt-3" value="identity">
              <Textarea
                className="font-mono text-sm"
                id="agent-identity"
                onChange={(e) => setIdentity(e.target.value)}
                placeholder={
                  'Voice, tone, name preferences, hobbies, anything that makes this agent feel like a specific person. Empty is fine — the agent will just present a generic helper persona.'
                }
                rows={12}
                value={identity}
              />
              <p className="mt-2 text-muted-foreground text-xs">
                Saved to <span className="font-mono">SOUL.md</span> in the
                agent&apos;s memory volume.
              </p>
            </TabsContent>
            <TabsContent className="mt-3" value="instructions">
              <Textarea
                className="font-mono text-sm"
                id="agent-instructions"
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={
                  'Operating manual. What does this agent do during heartbeats? Which memory files matter? When should it ping the user? Empty falls back to the platform default template.'
                }
                rows={12}
                value={instructions}
              />
              <p className="mt-2 text-muted-foreground text-xs">
                Saved to <span className="font-mono">AGENTS.md</span> in the
                agent&apos;s memory volume.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="grid gap-3 border-foreground border-b-2 pb-8 md:grid-cols-[12rem_minmax(0,1fr)]">
        <Label htmlFor="agent-model">Model</Label>
        <div className="flex flex-col gap-2">
          <Select onValueChange={setModel} value={model}>
            <SelectTrigger id="agent-model">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {ownedByKeys.length === 0 ? (
                <SelectItem value={defaultModel}>{defaultModel}</SelectItem>
              ) : (
                ownedByKeys.map((ownedBy) => (
                  <SelectGroup key={ownedBy}>
                    <SelectLabel>{ownedBy}</SelectLabel>
                    {grouped[ownedBy].map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-medium">{m.name}</span>
                        <span className="ml-2 text-muted-foreground text-xs">
                          {(m.contextWindow / 1000).toFixed(0)}k ctx
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Routed through the Vercel AI Gateway. Filtered to models that
            support tool calling.
          </p>
        </div>
      </div>

      <div className="swiss-diagonal grid gap-4 border-2 border-foreground bg-muted p-5 md:grid-cols-[12rem_minmax(0,1fr)]">
        <Label
          className="font-bold text-sm uppercase tracking-[0.14em]"
          htmlFor="agent-heartbeat"
        >
          Heartbeat
        </Label>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs">
                When on, the agent wakes on a fixed cadence to do proactive
                work. Off means it only runs when you chat or click Trigger.
              </p>
            </div>
            <Switch
              checked={heartbeatEnabled}
              id="agent-heartbeat"
              onCheckedChange={setHeartbeatEnabled}
            />
          </div>
          {heartbeatEnabled ? (
            <div className="flex flex-col gap-2">
              <Label className="text-sm" htmlFor="agent-interval">
                Interval
              </Label>
              <Select
                onValueChange={(v) =>
                  setIntervalMinutes(Number.parseInt(v, 10))
                }
                value={String(intervalMinutes)}
              >
                <SelectTrigger id="agent-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Reflection runs at most once per N minutes, and at least once
                per local day.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 border-2 border-foreground bg-background p-5 md:grid-cols-[12rem_minmax(0,1fr)]">
        <Label
          className="font-bold text-sm uppercase tracking-[0.14em]"
          htmlFor="agent-reflection"
        >
          Reflection
        </Label>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs">
                When on, the agent periodically reviews its logs, writes
                DREAMS.md, and proposes updates to goals or tasks. This can run
                even when heartbeat is off.
              </p>
            </div>
            <Switch
              checked={reflectionEnabled}
              id="agent-reflection"
              onCheckedChange={setReflectionEnabled}
            />
          </div>
          {reflectionEnabled ? (
            <div className="flex flex-col gap-2">
              <Label className="text-sm" htmlFor="agent-reflection-interval">
                Reflection cadence
              </Label>
              <Select
                onValueChange={(v) =>
                  setReflectionIntervalMinutes(Number.parseInt(v, 10))
                }
                value={String(reflectionIntervalMinutes)}
              >
                <SelectTrigger id="agent-reflection-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button
          disabled={pending}
          onClick={() => router.back()}
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        <Button disabled={pending} type="submit">
          {pending ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
