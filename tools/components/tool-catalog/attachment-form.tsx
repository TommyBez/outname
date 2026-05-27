'use client'

import { useRouter } from 'next/navigation'
import type { FormEventHandler } from 'react'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { attachToolAction, detachToolAction } from '@/tools/actions'
import { CatalogActionButtons } from './action-buttons'
import { ConfigField } from './config-field'
import { partitionConfigFields } from './config-field-utils'
import { GroupConfigPanel } from './group-config-panel'
import type { AttachedToolView, ToolCatalogEntry } from './types'
import { defaultValuesFor, submitButtonLabel } from './utils'

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
  const hasFields =
    entry.configFields.length > 0 || entry.credentialOverrideFields.length > 0
  const { generalFields, globalReadOnlyField, groupSections } = useMemo(
    () => partitionConfigFields(entry.configFields),
    [entry.configFields]
  )

  function handleAttach() {
    const config = buildToolConfig(entry, values)
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

  function handleClearOverride(connectorId: string) {
    const config = buildToolConfig(entry, values, {
      clearCredentialOverrideConnector: connectorId,
    })
    startTransition(async () => {
      const result = await attachToolAction(agentId, entry.toolId, config)
      if (!result.ok) {
        toast.error(result.error ?? 'Clear override failed.')
        return
      }
      toast.success('Credential override cleared.')
      setOpen(false)
      router.refresh()
    })
  }

  const handleAttachSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    handleAttach()
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
          className="flex w-full max-w-2xl flex-col gap-3 border-2 border-foreground bg-muted p-4"
          onSubmit={handleAttachSubmit}
        >
          {generalFields.map((field) => (
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
          <GroupConfigPanel
            disabled={pending}
            globalReadOnlyField={globalReadOnlyField}
            groupSections={groupSections}
            onChange={setValues}
            values={values}
          />
          {entry.credentialOverrideFields.map((group) => (
            <div className="flex flex-col gap-3" key={group.connectorId}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black font-mono text-xs uppercase tracking-[0.08em]">
                  {group.displayName} credential override
                </p>
                {group.hasOverride && (
                  <button
                    className="inline-flex h-8 items-center justify-center border-2 border-foreground px-3 font-bold text-[10px] uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
                    disabled={pending}
                    onClick={() => handleClearOverride(group.connectorId)}
                    type="button"
                  >
                    Clear override
                  </button>
                )}
              </div>
              {group.fields.map((field) => {
                const valueKey = credentialOverrideValueKey(
                  group.connectorId,
                  field.name
                )
                return (
                  <ConfigField
                    field={field}
                    key={valueKey}
                    onChange={(value) =>
                      setValues((current) => ({
                        ...current,
                        [valueKey]: value,
                      }))
                    }
                    toolId={`${entry.toolId}-${group.connectorId}-credential`}
                    value={values[valueKey] ?? ''}
                  />
                )
              })}
            </div>
          ))}
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            {submitButtonLabel(pending, isAttached)}
          </button>
        </form>
      )}
    </div>
  )
}

function buildToolConfig(
  entry: ToolCatalogEntry,
  values: Record<string, string>,
  options?: {
    clearCredentialOverrideConnector?: string
  }
): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  for (const field of entry.configFields) {
    const value = coerceFieldValue(field, values[field.name] ?? '')
    if (value !== undefined && value !== '') {
      config[field.name] = value
    }
  }

  const credentialOverrides = collectCredentialOverrides(
    entry,
    values,
    options?.clearCredentialOverrideConnector
  )
  if (credentialOverrides) {
    config.credentialOverrides = credentialOverrides
  }
  if (options?.clearCredentialOverrideConnector) {
    config.credentialOverrideRemovals = [
      options.clearCredentialOverrideConnector,
    ]
  }
  return config
}

function collectCredentialOverrides(
  entry: ToolCatalogEntry,
  values: Record<string, string>,
  omittedConnector?: string
): Record<string, Record<string, string>> | undefined {
  const credentialOverrides: Record<string, Record<string, string>> = {}

  for (const group of entry.credentialOverrideFields) {
    if (group.connectorId === omittedConnector) {
      continue
    }
    const connectorFields: Record<string, string> = {}
    for (const field of group.fields) {
      const value =
        values[credentialOverrideValueKey(group.connectorId, field.name)]
      if (value && value.trim().length > 0) {
        connectorFields[field.name] = value
      }
    }

    if (Object.keys(connectorFields).length > 0) {
      credentialOverrides[group.connectorId] = connectorFields
    }
  }

  return Object.keys(credentialOverrides).length > 0
    ? credentialOverrides
    : undefined
}

function credentialOverrideValueKey(connectorId: string, fieldName: string) {
  return `credentialOverride:${connectorId}:${fieldName}`
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
