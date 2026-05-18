'use client'

import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { attachToolAction, detachToolAction } from '@/tools/actions'
import { CatalogActionButtons } from './action-buttons'
import { ConfigField } from './config-field'
import type {
  AttachedToolView,
  ToolCatalogEntry,
  ToolConfigField,
} from './types'
import { defaultValuesFor, submitButtonLabel } from './utils'
import { Button } from '@/components/ui/button'

interface AttachmentFormProps {
  agentId: string
  attached: AttachedToolView | null
  entry: ToolCatalogEntry
  isAttached: boolean
  isBuilding: boolean
  isFailedPending: boolean
  isPending: boolean
}

export function AttachmentForm({
  agentId,
  entry,
  attached,
  isBuilding,
  isAttached,
  isFailedPending,
  isPending,
}: AttachmentFormProps) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const initial = useMemo(
    () => defaultValuesFor(entry, attached),
    [entry, attached]
  )
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [open, setOpen] = useState(false)
  const hasFields = entry.configFields.length > 0

  function handleAttach(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const config: Record<string, unknown> = {}
    for (const field of entry.configFields) {
      const value = coerceFieldValue(field, values[field.name] ?? '')
      if (value !== undefined && value !== '') {
        config[field.name] = value
      }
    }
    startTransition(async () => {
      const result = await attachToolAction(agentId, entry.toolId, config)
      if (!result.ok) {
        toast.error(result.error ?? 'Attach failed.')
        return
      }
      if (result.pendingBuildId) {
        toast.success('Tool environment is being prepared...')
      } else {
        toast.success(isAttached ? 'Tool updated.' : 'Tool attached.')
      }
      setOpen(false)
      router.refresh()
    })
  }

  function handleDetach() {
    startTransition(async () => {
      const result = await detachToolAction(agentId, entry.toolId)
      if (!result.ok) {
        toast.error(result.error ?? 'Detach failed.')
        return
      }
      toast.success('Tool detached.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <CatalogActionButtons
        hasFields={hasFields}
        isAttached={isAttached}
        isBuilding={isBuilding}
        isFailedPending={isFailedPending}
        isPending={isPending}
        onAttach={() => handleAttach()}
        onDetach={handleDetach}
        onToggleOpen={() => setOpen((value) => !value)}
        open={open}
        pending={pending}
      />
      {open && hasFields && (
        <form
          className="flex w-full max-w-lg flex-col gap-3 border-2 border-foreground bg-muted p-4"
          onSubmit={handleAttach}
        >
          {entry.configFields.map((field) => (
            <ConfigField
              field={field}
              key={field.name}
              onChange={(value) =>
                setValues((current) => ({
                  ...current,
                  [field.name]: value,
                }))
              }
              toolId={entry.toolId}
              value={values[field.name] ?? ''}
            />
          ))}
          <Button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            {submitButtonLabel(pending, isAttached)}
          </Button>
        </form>
      )}
    </div>
  )
}

function coerceFieldValue(field: ToolConfigField, raw: string) {
  if (field.type === 'number') {
    return raw === '' ? undefined : Number(raw)
  }
  if (field.type === 'boolean') {
    return raw === 'true'
  }
  return raw
}
