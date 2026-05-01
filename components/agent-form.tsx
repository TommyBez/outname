'use client'

import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { createAgentAction, updateAgentAction } from '@/lib/agent-actions'
import type { ModelOption } from '@/lib/ai-gateway-models'
import { cn } from '@/lib/utils'

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

const BOOTSTRAP_FILE_OPTIONS = [
  {
    value: 'identity-card',
    label: 'Identity card',
    fileName: 'IDENTITY.md',
  },
  {
    value: 'identity',
    label: 'Persona',
    fileName: 'SOUL.md',
  },
  {
    value: 'instructions',
    label: 'Instructions',
    fileName: 'AGENTS.md',
  },
  {
    value: 'user-profile',
    label: 'User profile',
    fileName: 'USER.md',
  },
] as const

type BootstrapFileValue = (typeof BOOTSTRAP_FILE_OPTIONS)[number]['value']

const selectedModelSort =
  (selectedId: string) => (a: ModelOption, b: ModelOption) => {
    if (a.id === selectedId) {
      return -1
    }
    if (b.id === selectedId) {
      return 1
    }
    return 0
  }

function modelMatchesSearch(option: ModelOption, search: string) {
  const query = search.trim().toLowerCase()
  if (!query) {
    return true
  }
  return [option.name, option.id, option.ownedBy].some((candidate) =>
    candidate.toLowerCase().includes(query)
  )
}

function uniqueModelsById(options: ModelOption[]) {
  const seen = new Set<string>()
  const unique: ModelOption[] = []
  for (const option of options) {
    if (seen.has(option.id)) {
      continue
    }
    seen.add(option.id)
    unique.push(option)
  }
  return unique
}

interface AgentFormProps {
  defaultModel: string
  /**
   * Empty = create form, populated = edit form. `enabled` mirrors
   * `agent.enabled` and stays unchanged by this form — toggle it
   * from the overview page.
   *
   * `identityCard`, `identity`, `instructions`, and `userProfile` are
   * pre-filled from the most recent `pending_file_writes` row for
   * IDENTITY.md / SOUL.md / AGENTS.md / USER.md (the UI's source of
   * truth for what's effectively on disk). The caller should pass empty
   * strings on a brand-new agent — the form treats those as "show the
   * placeholders" and doesn't enqueue a write unless the operator
   * actually types something.
   */
  initial?: {
    id: string
    name: string
    identityCard: string
    identity: string
    instructions: string
    userProfile: string
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
  const [identityCard, setIdentityCard] = useState(initial?.identityCard ?? '')
  const [identity, setIdentity] = useState(initial?.identity ?? '')
  const [instructions, setInstructions] = useState(initial?.instructions ?? '')
  const [userProfile, setUserProfile] = useState(initial?.userProfile ?? '')
  const [modelDialogOpen, setModelDialogOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [activeBootstrapFile, setActiveBootstrapFile] =
    useState<BootstrapFileValue>('identity-card')
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

  const availableModels = uniqueModelsById(
    models.length > 0
      ? models
      : [
          {
            contextWindow: 0,
            id: defaultModel,
            name: defaultModel,
            ownedBy: 'gateway',
          },
        ]
  )
  const selectedModel =
    availableModels.find((option) => option.id === model) ?? availableModels[0]

  const sortedModels = useMemo(
    () => [...availableModels].sort(selectedModelSort(model)),
    [availableModels, model]
  )
  const visibleModels = useMemo(
    () =>
      sortedModels.filter((option) => modelMatchesSearch(option, modelSearch)),
    [sortedModels, modelSearch]
  )

  // Group models by provider so a searchable command menu stays scannable.
  const grouped = visibleModels.reduce<Record<string, ModelOption[]>>(
    (acc, option) => {
      const key = option.ownedBy
      let group = acc[key]
      if (!group) {
        group = []
        acc[key] = group
      }
      group.push(option)
      return acc
    },
    {}
  )
  const ownedByKeys = Object.keys(grouped).sort((a, b) => {
    if (a === selectedModel?.ownedBy) {
      return -1
    }
    if (b === selectedModel?.ownedBy) {
      return 1
    }
    return a.localeCompare(b)
  })

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
            identityCard,
            identityCardOriginal: initial.identityCard,
            instructions,
            instructionsOriginal: initial.instructions,
            userProfile,
            userProfileOriginal: initial.userProfile,
            model,
            heartbeatEnabled,
            heartbeatIntervalMinutes: intervalMinutes,
            reflectionEnabled,
            reflectionIntervalMinutes,
            soul: identity,
            soulOriginal: initial.identity,
          })
          toast.success('Agent updated')
          router.refresh()
        } else {
          const result = await createAgentAction({
            name: trimmed,
            identityCard,
            instructions,
            userProfile,
            model,
            heartbeatEnabled,
            heartbeatIntervalMinutes: intervalMinutes,
            reflectionEnabled,
            reflectionIntervalMinutes,
            soul: identity,
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
          <Label>Bootstrap files</Label>
        </div>
        <div>
          <p className="mb-4 max-w-2xl text-muted-foreground text-xs leading-relaxed">
            {
              "These four files are inlined into the agent's system prompt on every event when present. IDENTITY.md is the quick persona card, SOUL.md is the deeper personality layer, AGENTS.md is the operating manual, and USER.md is the user profile. The agent can read them via read_memory, but only USER.md remains agent-maintained."
            }
          </p>
          <div className="mb-3 flex flex-col gap-2 md:hidden">
            <Label
              className="font-bold text-xs uppercase tracking-[0.14em]"
              htmlFor="bootstrap-file-view"
            >
              File view
            </Label>
            <Select
              onValueChange={(value) =>
                setActiveBootstrapFile(value as BootstrapFileValue)
              }
              value={activeBootstrapFile}
            >
              <SelectTrigger
                className="w-full text-left normal-case tracking-normal"
                id="bootstrap-file-view"
              >
                <SelectValue placeholder="Choose a bootstrap file" />
              </SelectTrigger>
              <SelectContent align="start" position="popper">
                {BOOTSTRAP_FILE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {`${option.label} (${option.fileName})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Pick one file at a time on smaller screens.
            </p>
          </div>
          <Tabs
            className="mt-1"
            onValueChange={(value) =>
              setActiveBootstrapFile(value as BootstrapFileValue)
            }
            value={activeBootstrapFile}
          >
            <TabsList className="hidden w-full grid-cols-4 md:grid">
              <TabsTrigger value="identity-card">
                Identity card (IDENTITY.md)
              </TabsTrigger>
              <TabsTrigger value="identity">Persona (SOUL.md)</TabsTrigger>
              <TabsTrigger value="instructions">
                Instructions (AGENTS.md)
              </TabsTrigger>
              <TabsTrigger value="user-profile">
                User profile (USER.md)
              </TabsTrigger>
            </TabsList>
            <TabsContent className="mt-3" value="identity-card">
              <Textarea
                className="font-mono text-sm"
                id="agent-identity-card"
                onChange={(e) => setIdentityCard(e.target.value)}
                placeholder={
                  'A compact first-impression card. Example:\nYou are ROOK.\nRole: snarky research associate + code reviewer\nVibe: Unreasonably cheerful, terminally online, but surprisingly wise.\nEmoji: 🐙\nSign-off: "Over and out, meatbag."'
                }
                rows={10}
                value={identityCard}
              />
              <p className="mt-2 text-muted-foreground text-xs">
                Saved to <span className="font-mono">IDENTITY.md</span> in the
                agent&apos;s memory volume. Keep it short and scannable.
              </p>
            </TabsContent>
            <TabsContent className="mt-3" value="identity">
              <Textarea
                className="font-mono text-sm"
                id="agent-identity"
                onChange={(e) => setIdentity(e.target.value)}
                placeholder={
                  'Deeper persona guidance: voice, tone, values, preferences, habits, and boundaries. Empty is fine — the agent will lean on IDENTITY.md plus its built-in defaults.'
                }
                rows={12}
                value={identity}
              />
              <p className="mt-2 text-muted-foreground text-xs">
                Saved to <span className="font-mono">SOUL.md</span> in the
                agent&apos;s memory volume for the long-form persona layer.
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
            <TabsContent className="mt-3" value="user-profile">
              <Textarea
                className="font-mono text-sm"
                id="agent-user-profile"
                onChange={(e) => setUserProfile(e.target.value)}
                placeholder={
                  '## Basic Info\n- What to call me:\n- My timezone:\n\n## My World\n- Current projects, role, usual tasks.\n\n## Communication Style\n- I like:\n- I dislike:\n\n## Delivery Preferences\n- Formatting, language, code, or review preferences.\n\n## Hard Boundaries\n- Actions forbidden without explicit approval.'
                }
                rows={12}
                value={userProfile}
              />
              <p className="mt-2 text-muted-foreground text-xs">
                Seeds or corrects <span className="font-mono">USER.md</span>.
                The agent can update this file as it learns stable facts.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="grid gap-3 border-foreground border-b-2 pb-8 md:grid-cols-[12rem_minmax(0,1fr)]">
        <Label htmlFor="agent-model">Model</Label>
        <div className="flex flex-col gap-2">
          <Button
            aria-expanded={modelDialogOpen}
            aria-haspopup="dialog"
            className="h-auto min-h-11 w-full justify-between gap-4 whitespace-normal px-3 py-2 text-left normal-case tracking-normal"
            id="agent-model"
            onClick={() => {
              setModelSearch('')
              setModelDialogOpen(true)
            }}
            type="button"
            variant="outline"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium text-sm">
                {selectedModel?.name ?? 'Select a model'}
              </span>
              {selectedModel ? (
                <span className="truncate text-muted-foreground text-xs">
                  {selectedModel.id}
                </span>
              ) : null}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
          </Button>
          <CommandDialog
            className="border-2 border-foreground sm:max-w-2xl"
            commandProps={{
              shouldFilter: false,
            }}
            description="Search models by name, id, or provider."
            onOpenChange={(open) => {
              setModelDialogOpen(open)
              if (!open) {
                setModelSearch('')
              }
            }}
            open={modelDialogOpen}
            showHeader
            title="Select model"
          >
            <CommandInput
              onValueChange={setModelSearch}
              placeholder="Search models..."
              value={modelSearch}
            />
            <CommandList className="max-h-[60vh] pr-1">
              <CommandEmpty>No models found.</CommandEmpty>
              {ownedByKeys.map((ownedBy) => (
                <CommandGroup heading={ownedBy} key={ownedBy} value={ownedBy}>
                  {grouped[ownedBy].map((option) => (
                    <CommandItem
                      className="data-[selected=true]:[&_span]:text-accent-foreground data-[selected=true]:[&_svg]:text-accent-foreground"
                      key={option.id}
                      onSelect={(selectedId) => {
                        setModel(selectedId)
                        setModelDialogOpen(false)
                      }}
                      value={option.id}
                    >
                      <CheckIcon
                        className={cn(
                          'size-4 text-current',
                          model === option.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">
                          {option.name}
                        </span>
                        <span className="truncate text-muted-foreground text-xs">
                          {option.id}
                        </span>
                      </span>
                      <span className="shrink-0 border border-border px-1.5 py-0.5 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
                        {option.ownedBy}
                      </span>
                      {model === option.id ? (
                        <span className="shrink-0 border border-current px-1.5 py-0.5 font-bold text-[10px] uppercase tracking-[0.14em]">
                          Current
                        </span>
                      ) : null}
                      {option.contextWindow > 0 ? (
                        <span className="mr-2 shrink-0 text-muted-foreground text-xs">
                          {(option.contextWindow / 1000).toFixed(0)}k ctx
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </CommandDialog>
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
