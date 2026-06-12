'use client'

import type { InferenceProvider } from '@outname/db/schema'
import type { AgentScheduleMode } from '@outname/shared/agent-schedule'
import {
  createAgentAction,
  updateAgentAction,
} from '@outname/shared/agents/server/actions'
import type { ModelOption } from '@outname/shared/server/inference-models'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@outname/ui/components/ui/alert-dialog'
import { Button } from '@outname/ui/components/ui/button'
import { Input } from '@outname/ui/components/ui/input'
import { Label } from '@outname/ui/components/ui/label'
import { useUnsavedChangesGuard } from '@outname/ui/hooks/use-unsaved-changes-guard'
import { useRouter } from 'next/navigation'
import {
  type FormEvent,
  useMemo,
  useReducer,
  useState,
  useTransition,
} from 'react'
import { toast } from 'sonner'
import {
  agentFormReducer,
  createAgentFormState,
  isAgentFormDirty,
} from './agent-form/agent-form-state'
import { BootstrapFiles } from './agent-form/bootstrap-files'
import { ConfigureSection } from './agent-form/configure-section'
import { DreamingSettings } from './agent-form/dreaming-settings'
import { HeartbeatSettings } from './agent-form/heartbeat-settings'
import { ModelSelector } from './agent-form/model-selector'
import type {
  AgentFormInitial,
  InferenceProviderOption,
  StepLimitMode,
} from './agent-form/options'
import { StepLimitSettings } from './agent-form/step-limit-settings'

interface AgentFormProps {
  defaultInferenceProvider: InferenceProvider
  defaultModel: string
  defaultModelByProvider: Record<InferenceProvider, string>
  initial?: AgentFormInitial
  models: ModelOption[]
  providers: InferenceProviderOption[]
  timezoneLabel: string
}

export function AgentForm({
  defaultInferenceProvider,
  models,
  defaultModel,
  defaultModelByProvider,
  initial,
  providers,
  timezoneLabel,
}: AgentFormProps) {
  const { back, push, refresh } = useRouter()
  const [pending, startTransition] = useTransition()
  const [state, dispatch] = useReducer(
    agentFormReducer,
    { defaultInferenceProvider, defaultModel, initial },
    createAgentFormState
  )
  const isEdit = Boolean(initial?.id)
  const submitLabel = isEdit ? 'Save changes' : 'Create agent'
  const initialFormState = useMemo(
    () =>
      createAgentFormState({ defaultInferenceProvider, defaultModel, initial }),
    [defaultInferenceProvider, defaultModel, initial]
  )
  const isDirty = isAgentFormDirty(state, initialFormState)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  useUnsavedChangesGuard(isDirty && !pending)

  function handleCancel() {
    if (isDirty) {
      setShowDiscardConfirm(true)
      return
    }
    back()
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = state.name.trim()
    if (!trimmed) {
      toast.error('Name is required')
      return
    }
    startTransition(async () => {
      await saveAgent({
        trimmedName: trimmed,
        initial,
        values: {
          heartbeatEnabled: state.heartbeatEnabled,
          heartbeatScheduleMode: state.heartbeatScheduleMode,
          heartbeatScheduleTimes: state.heartbeatScheduleTimes,
          identity: state.identity,
          identityCard: state.identityCard,
          inferenceProvider: state.inferenceProvider,
          instructions: state.instructions,
          intervalMinutes: state.intervalMinutes,
          model: state.model,
          dreamingEnabled: state.dreamingEnabled,
          stepLimitCustom: state.stepLimitCustom,
          stepLimitMode: state.stepLimitMode,
          userProfile: state.userProfile,
        },
        router: { push, refresh },
      })
    })
  }

  return (
    <form className="flex flex-col gap-10" onSubmit={handleSubmit}>
      <ConfigureSection
        description="Name and high-level identity for wayfinding across the app."
        id="profile"
        title="Profile"
      >
        <div className="grid gap-3 border-foreground border-b-2 pb-8 md:grid-cols-[12rem_minmax(0,1fr)]">
          <Label htmlFor="agent-name">Name</Label>
          <div className="flex flex-col gap-2">
            <Input
              id="agent-name"
              maxLength={120}
              onChange={(e) =>
                dispatch({ type: 'set_name', value: e.target.value })
              }
              placeholder="Research Buddy"
              required
              value={state.name}
            />
            <p className="text-muted-foreground text-xs">
              Shown in the sidebar and at the top of every chat.
            </p>
          </div>
        </div>
      </ConfigureSection>

      <ConfigureSection
        description="Protected markdown seeds that shape the agent before each event."
        id="memory-seeds"
        title="Memory seeds"
      >
        <BootstrapFiles
          activeBootstrapFile={state.activeBootstrapFile}
          identity={state.identity}
          identityCard={state.identityCard}
          instructions={state.instructions}
          setActiveBootstrapFile={(value) =>
            dispatch({ type: 'set_active_bootstrap_file', value })
          }
          setIdentity={(value) => dispatch({ type: 'set_identity', value })}
          setIdentityCard={(value) =>
            dispatch({ type: 'set_identity_card', value })
          }
          setInstructions={(value) =>
            dispatch({ type: 'set_instructions', value })
          }
          setUserProfile={(value) =>
            dispatch({ type: 'set_user_profile', value })
          }
          userProfile={state.userProfile}
        />
      </ConfigureSection>

      <ConfigureSection
        description="Model, step limit, heartbeat cadence, and dreaming on/off."
        id="runtime"
        title="Runtime"
      >
        <div className="flex flex-col gap-8">
          <ModelSelector
            defaultModel={defaultModel}
            defaultModelByProvider={defaultModelByProvider}
            inferenceProvider={state.inferenceProvider}
            model={state.model}
            models={models}
            providers={providers}
            setInferenceProvider={(value) => {
              const providerModels = models.filter(
                (option) => option.inferenceProvider === value
              )
              const nextModel = providerModels.some(
                (option) => option.id === state.model
              )
                ? state.model
                : defaultModelByProvider[value]
              dispatch({ type: 'set_inference_provider', value })
              dispatch({ type: 'set_model', value: nextModel })
            }}
            setModel={(value) => dispatch({ type: 'set_model', value })}
          />
          <StepLimitSettings
            setStepLimitCustom={(value) =>
              dispatch({ type: 'set_step_limit_custom', value })
            }
            setStepLimitMode={(value) =>
              dispatch({ type: 'set_step_limit_mode', value })
            }
            stepLimitCustom={state.stepLimitCustom}
            stepLimitMode={state.stepLimitMode}
          />
          <HeartbeatSettings
            heartbeatEnabled={state.heartbeatEnabled}
            intervalMinutes={state.intervalMinutes}
            scheduleMode={state.heartbeatScheduleMode}
            scheduleTimes={state.heartbeatScheduleTimes}
            setHeartbeatEnabled={(value) =>
              dispatch({ type: 'set_heartbeat_enabled', value })
            }
            setIntervalMinutes={(value) =>
              dispatch({ type: 'set_interval_minutes', value })
            }
            setScheduleMode={(value) =>
              dispatch({ type: 'set_heartbeat_schedule_mode', value })
            }
            setScheduleTimes={(value) =>
              dispatch({ type: 'set_heartbeat_schedule_times', value })
            }
            timezoneLabel={timezoneLabel}
          />
          <DreamingSettings
            dreamingEnabled={state.dreamingEnabled}
            setDreamingEnabled={(value) =>
              dispatch({ type: 'set_dreaming_enabled', value })
            }
          />
        </div>
      </ConfigureSection>

      <div className="flex items-center justify-end gap-3">
        {isDirty && !pending ? (
          <p
            aria-live="polite"
            className="font-mono text-muted-foreground text-xs"
          >
            Unsaved changes
          </p>
        ) : null}
        <Button
          disabled={pending}
          onClick={handleCancel}
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        <Button disabled={pending} type="submit">
          {pending ? 'Saving...' : submitLabel}
        </Button>
      </div>

      <AlertDialog
        onOpenChange={setShowDiscardConfirm}
        open={showDiscardConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have edits that have not been saved. Leaving now will throw
              them away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Keep editing</AlertDialogCancel>
            <Button
              onClick={() => {
                setShowDiscardConfirm(false)
                back()
              }}
              size="sm"
              type="button"
              variant="destructive"
            >
              Discard changes
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

async function saveAgent(input: {
  initial?: AgentFormInitial
  router: Pick<ReturnType<typeof useRouter>, 'push' | 'refresh'>
  trimmedName: string
  values: {
    heartbeatEnabled: boolean
    heartbeatScheduleMode: AgentScheduleMode
    heartbeatScheduleTimes: string[]
    identity: string
    identityCard: string
    inferenceProvider: InferenceProvider
    instructions: string
    intervalMinutes: number
    model: string
    dreamingEnabled: boolean
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
        inferenceProvider: input.values.inferenceProvider,
        model: input.values.model,
        heartbeatEnabled: input.values.heartbeatEnabled,
        heartbeatScheduleMode: input.values.heartbeatScheduleMode,
        heartbeatScheduleTimes: input.values.heartbeatScheduleTimes,
        heartbeatIntervalMinutes: input.values.intervalMinutes,
        dreamingEnabled: input.values.dreamingEnabled,
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
      inferenceProvider: input.values.inferenceProvider,
      model: input.values.model,
      heartbeatEnabled: input.values.heartbeatEnabled,
      heartbeatScheduleMode: input.values.heartbeatScheduleMode,
      heartbeatScheduleTimes: input.values.heartbeatScheduleTimes,
      heartbeatIntervalMinutes: input.values.intervalMinutes,
      dreamingEnabled: input.values.dreamingEnabled,
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
