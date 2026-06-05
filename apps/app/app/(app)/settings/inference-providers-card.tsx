'use client'

import {
  removeInferenceProviderKeyAction,
  type SaveInferenceProviderKeyFormState,
  saveInferenceProviderKeyFormAction,
  setDefaultInferenceProviderAction,
} from '@outname/auth/settings/actions'
import type { InferenceProvider } from '@outname/db/schema'
import { Button } from '@outname/ui/components/ui/button'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

const INITIAL_SAVE_KEY_FORM_STATE: SaveInferenceProviderKeyFormState = {
  message: null,
  status: 'idle',
  submittedAt: 0,
}

interface ProviderState {
  enabled: boolean
  inferenceProvider: InferenceProvider
  isDefault: boolean
  keyPlaceholder: string
  label: string
  lastError: string | null
  status: 'enabled' | 'invalid' | null
  verifiedAt: string | null
}

export function InferenceProvidersCard({
  providers,
}: {
  providers: ProviderState[]
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-xs">
        Agent runs use your saved provider keys. New agents need an explicit
        provider choice when more than one provider is configured.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {providers.map((provider) => (
          <InferenceProviderForm
            key={provider.inferenceProvider}
            provider={provider}
          />
        ))}
      </div>
    </div>
  )
}

function InferenceProviderForm({ provider }: { provider: ProviderState }) {
  const [apiKey, setApiKey] = useState('')
  const [saveState, saveKeyAction, savePending] = useActionState(
    saveInferenceProviderKeyFormAction,
    INITIAL_SAVE_KEY_FORM_STATE
  )
  const [mutationPending, startTransition] = useTransition()
  const { refresh } = useRouter()
  const pending = savePending || mutationPending

  useEffect(() => {
    if (saveState.submittedAt === 0) {
      return
    }
    if (saveState.status === 'success') {
      toast.success(saveState.message ?? 'Key verified and saved.')
      setApiKey('')
      refresh()
      return
    }
    if (saveState.status === 'error') {
      toast.error(saveState.message ?? 'Unable to save key.')
    }
  }, [saveState, refresh])

  return (
    <form
      action={saveKeyAction}
      className="flex flex-col gap-3 border-2 border-foreground p-4"
    >
      <input
        name="inferenceProvider"
        type="hidden"
        value={provider.inferenceProvider}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black font-serif text-xl uppercase leading-tight tracking-[-0.04em]">
            {provider.label}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            Status: {provider.enabled ? 'Configured' : 'Missing'}
            {provider.isDefault ? ' · Default' : ''}
          </p>
        </div>
        {provider.enabled && !provider.isDefault ? (
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await setDefaultInferenceProviderAction(
                  provider.inferenceProvider
                )
                if (!result.ok) {
                  toast.error(
                    result.error ?? 'Unable to update default provider.'
                  )
                  return
                }
                toast.success('Default provider updated.')
                refresh()
              })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            Set default
          </Button>
        ) : null}
      </div>
      <input
        aria-label={`${provider.label} API key`}
        className="h-10 border-2 border-foreground bg-background px-3 font-mono text-sm"
        name="apiKey"
        onChange={(event) => setApiKey(event.target.value)}
        placeholder={provider.keyPlaceholder}
        required={!provider.enabled}
        type="password"
        value={apiKey}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} size="sm" type="submit">
          {savePending ? 'Saving...' : 'Save key'}
        </Button>
        {provider.enabled ? (
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await removeInferenceProviderKeyAction(
                  provider.inferenceProvider
                )
                if (!result.ok) {
                  toast.error('Unable to remove key.')
                  return
                }
                toast.success('Key removed.')
                refresh()
              })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            Remove
          </Button>
        ) : null}
      </div>
      {provider.verifiedAt ? (
        <p className="text-muted-foreground text-xs">
          Last verified {new Date(provider.verifiedAt).toLocaleString()}
        </p>
      ) : null}
      {provider.lastError ? (
        <p className="text-destructive text-xs">{provider.lastError}</p>
      ) : null}
    </form>
  )
}
