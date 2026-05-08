'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createAgentAction, updateAgentAction } from '@/agents/server/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ModelOption } from '@/shared/server/ai-gateway-models'
import { BootstrapFiles } from './agent-form/bootstrap-files'
import { ModelSelector } from './agent-form/model-selector'
import type {
  AgentFormInitial,
  BootstrapFileValue,
  StepLimitMode,
} from './agent-form/options'
import {
  HeartbeatSettings,
  ReflectionSettings,
  StepLimitSettings,
} from './agent-form/runtime-settings'

interface AgentFormProps {
  defaultModel: string
  initial?: AgentFormInitial
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
  const [activeBootstrapFile, setActiveBootstrapFile] =
    useState<BootstrapFileValue>('identity-card')
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
  const [stepLimitMode, setStepLimitMode] = useState<StepLimitMode>(
    initial?.stepLimitMode ?? 'medium'
  )
  const [stepLimitCustom, setStepLimitCustom] = useState(
    initial?.stepLimitCustom ?? 30
  )
  const isEdit = Boolean(initial?.id)
  const submitLabel = isEdit ? 'Save changes' : 'Create agent'

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Name is required')
      return
    }
    startTransition(async () => {
      await saveAgent({
        trimmedName: trimmed,
        initial,
        values: {
          heartbeatEnabled,
          identity,
          identityCard,
          instructions,
          intervalMinutes,
          model,
          reflectionEnabled,
          reflectionIntervalMinutes,
          stepLimitCustom,
          stepLimitMode,
          userProfile,
        },
        router,
      })
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

      <BootstrapFiles
        activeBootstrapFile={activeBootstrapFile}
        identity={identity}
        identityCard={identityCard}
        instructions={instructions}
        setActiveBootstrapFile={setActiveBootstrapFile}
        setIdentity={setIdentity}
        setIdentityCard={setIdentityCard}
        setInstructions={setInstructions}
        setUserProfile={setUserProfile}
        userProfile={userProfile}
      />
      <ModelSelector
        defaultModel={defaultModel}
        model={model}
        models={models}
        setModel={setModel}
      />
      <StepLimitSettings
        setStepLimitCustom={setStepLimitCustom}
        setStepLimitMode={setStepLimitMode}
        stepLimitCustom={stepLimitCustom}
        stepLimitMode={stepLimitMode}
      />
      <HeartbeatSettings
        heartbeatEnabled={heartbeatEnabled}
        intervalMinutes={intervalMinutes}
        setHeartbeatEnabled={setHeartbeatEnabled}
        setIntervalMinutes={setIntervalMinutes}
      />
      <ReflectionSettings
        reflectionEnabled={reflectionEnabled}
        reflectionIntervalMinutes={reflectionIntervalMinutes}
        setReflectionEnabled={setReflectionEnabled}
        setReflectionIntervalMinutes={setReflectionIntervalMinutes}
      />

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

async function saveAgent(input: {
  initial?: AgentFormInitial
  router: ReturnType<typeof useRouter>
  trimmedName: string
  values: {
    heartbeatEnabled: boolean
    identity: string
    identityCard: string
    instructions: string
    intervalMinutes: number
    model: string
    reflectionEnabled: boolean
    reflectionIntervalMinutes: number
    stepLimitCustom: number
    stepLimitMode: StepLimitMode
    userProfile: string
  }
}) {
  try {
    if (input.initial) {
      await updateAgentAction({
        id: input.initial.id,
        name: input.trimmedName,
        identityCard: input.values.identityCard,
        identityCardOriginal: input.initial.identityCard,
        instructions: input.values.instructions,
        instructionsOriginal: input.initial.instructions,
        userProfile: input.values.userProfile,
        userProfileOriginal: input.initial.userProfile,
        model: input.values.model,
        heartbeatEnabled: input.values.heartbeatEnabled,
        heartbeatIntervalMinutes: input.values.intervalMinutes,
        reflectionEnabled: input.values.reflectionEnabled,
        reflectionIntervalMinutes: input.values.reflectionIntervalMinutes,
        stepLimitMode: input.values.stepLimitMode,
        stepLimitCustom: input.values.stepLimitCustom,
        soul: input.values.identity,
        soulOriginal: input.initial.identity,
      })
      toast.success('Agent updated')
      input.router.refresh()
      return
    }

    const result = await createAgentAction({
      name: input.trimmedName,
      identityCard: input.values.identityCard,
      instructions: input.values.instructions,
      userProfile: input.values.userProfile,
      model: input.values.model,
      heartbeatEnabled: input.values.heartbeatEnabled,
      heartbeatIntervalMinutes: input.values.intervalMinutes,
      reflectionEnabled: input.values.reflectionEnabled,
      reflectionIntervalMinutes: input.values.reflectionIntervalMinutes,
      stepLimitMode: input.values.stepLimitMode,
      stepLimitCustom: input.values.stepLimitCustom,
      soul: input.values.identity,
    })
    toast.success('Agent created')
    input.router.push(`/agents/${result.id}`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not save agent')
  }
}
