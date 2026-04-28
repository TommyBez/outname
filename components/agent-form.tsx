"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  createAgentAction,
  updateAgentAction,
} from "@/lib/agent-actions"
import type { ModelOption } from "@/lib/ai-gateway-models"

// Heartbeat interval is stored as minutes; a small allowlist keeps the
// UI predictable and the ticker math obvious. Phase 3 may move this
// onto a per-trigger row.
const INTERVAL_OPTIONS = [
  { value: 5, label: "Every 5 minutes" },
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 60, label: "Every hour" },
  { value: 180, label: "Every 3 hours" },
  { value: 360, label: "Every 6 hours" },
  { value: 720, label: "Every 12 hours" },
  { value: 1440, label: "Every day" },
] as const

interface AgentFormProps {
  models: ModelOption[]
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
  }
}

export function AgentForm({ models, defaultModel, initial }: AgentFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState(initial?.name ?? "")
  const [identity, setIdentity] = useState(initial?.identity ?? "")
  const [instructions, setInstructions] = useState(
    initial?.instructions ?? "",
  )
  // Default model falls back to the gateway's first id if our preferred
  // default isn't in the filtered list. Empty list (fallback mode) is
  // handled by rendering a single passthrough option.
  const [model, setModel] = useState(initial?.model ?? defaultModel)
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(
    initial?.heartbeatEnabled ?? true,
  )
  const [intervalMinutes, setIntervalMinutes] = useState(
    initial?.heartbeatIntervalMinutes ?? 30,
  )

  const isEdit = Boolean(initial?.id)
  const submitLabel = isEdit ? "Save changes" : "Create agent"

  // Group models by `ownedBy` so the <select> is browseable. Order is
  // alphabetical within each group; the gateway already returned them
  // sorted that way but we don't rely on it here.
  const grouped = models.reduce<Record<string, ModelOption[]>>((acc, m) => {
    ;(acc[m.ownedBy] ??= []).push(m)
    return acc
  }, {})
  const ownedByKeys = Object.keys(grouped).sort()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Name is required")
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
          })
          toast.success("Agent updated")
          router.refresh()
        } else {
          const result = await createAgentAction({
            name: trimmed,
            identity,
            instructions,
            model,
            heartbeatEnabled,
            heartbeatIntervalMinutes: intervalMinutes,
          })
          toast.success("Agent created")
          router.push(`/agents/${result.id}`)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save agent")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="agent-name">Name</Label>
        <Input
          id="agent-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Research Buddy"
          required
          maxLength={120}
        />
        <p className="text-xs text-muted-foreground">
          Shown in the sidebar and at the top of every chat.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Persona files</Label>
        <p className="text-xs text-muted-foreground">
          {
            "These two files are inlined verbatim into the agent's system prompt on every event. They live in the agent's memory volume — the agent can read them via memory_read but its tools refuse to write or delete them. Save here flushes to disk on the next event."
          }
        </p>
        <Tabs defaultValue="identity" className="mt-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="identity">Identity (SOUL.md)</TabsTrigger>
            <TabsTrigger value="instructions">
              Instructions (AGENTS.md)
            </TabsTrigger>
          </TabsList>
          <TabsContent value="identity" className="mt-3">
            <Textarea
              id="agent-identity"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder={
                "Voice, tone, name preferences, hobbies, anything that makes this agent feel like a specific person. Empty is fine — the agent will just present a generic helper persona."
              }
              rows={12}
              className="font-mono text-sm"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Saved to <span className="font-mono">SOUL.md</span> in the
              agent&apos;s memory volume.
            </p>
          </TabsContent>
          <TabsContent value="instructions" className="mt-3">
            <Textarea
              id="agent-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={
                "Operating manual. What does this agent do during heartbeats? Which memory files matter? When should it ping the user? Empty falls back to the platform default template."
              }
              rows={12}
              className="font-mono text-sm"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Saved to <span className="font-mono">AGENTS.md</span> in the
              agent&apos;s memory volume.
            </p>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="agent-model">Model</Label>
        <Select value={model} onValueChange={setModel}>
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
                      <span className="ml-2 text-xs text-muted-foreground">
                        {(m.contextWindow / 1000).toFixed(0)}k ctx
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Routed through the Vercel AI Gateway. Filtered to models that support
          tool calling.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="agent-heartbeat" className="text-sm font-medium">
              Heartbeat
            </Label>
            <p className="text-xs text-muted-foreground">
              When on, the agent wakes on a fixed cadence to do proactive work.
              Off means it only runs when you chat or click Trigger.
            </p>
          </div>
          <Switch
            id="agent-heartbeat"
            checked={heartbeatEnabled}
            onCheckedChange={setHeartbeatEnabled}
          />
        </div>
        {heartbeatEnabled ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="agent-interval" className="text-sm">
              Interval
            </Label>
            <Select
              value={String(intervalMinutes)}
              onValueChange={(v) => setIntervalMinutes(Number.parseInt(v, 10))}
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
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  )
}
