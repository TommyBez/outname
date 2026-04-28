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
  // Empty = create form, populated = edit form. `enabled` mirrors
  // `agent.enabled` (the soft delete / reachability flag from the
  // sidebar) and stays unchanged by this form — toggle it from the
  // overview page.
  initial?: {
    id: string
    name: string
    systemPrompt: string
    model: string
    heartbeatEnabled: boolean
    heartbeatIntervalMinutes: number
  }
}

export function AgentForm({ models, defaultModel, initial }: AgentFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState(initial?.name ?? "")
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? "")
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
            systemPrompt,
            model,
            heartbeatEnabled,
            heartbeatIntervalMinutes: intervalMinutes,
          })
          toast.success("Agent updated")
          router.refresh()
        } else {
          const result = await createAgentAction({
            name: trimmed,
            systemPrompt,
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
        <Label htmlFor="agent-system-prompt">System prompt</Label>
        <Textarea
          id="agent-system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a thoughtful research assistant. Keep notes in your memory volume."
          rows={8}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Threaded into the prompt under{" "}
          <span className="font-mono">## Operator instructions</span> on every
          turn. AGENTS.md and SOUL.md are inlined separately and stay
          user-managed.
        </p>
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
