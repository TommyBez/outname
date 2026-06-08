'use client'

import { Button } from '@outname/ui/components/ui/button'
import { useRouter } from 'next/navigation'
import type { FormEventHandler } from 'react'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CatalogActionButtons } from './action-buttons'
import { toolCatalogBuildPhase } from './build-phase'
import { ConfigField } from './config-field'
import { partitionConfigFields } from './config-field-utils'
import { GroupConfigPanel } from './group-config-panel'
import type {
  AttachedToolView,
  ToolCatalogEntry,
  ToolConfigField,
} from './types'
import { defaultValuesFor, submitButtonLabel } from './utils'

interface ToolMutationResult {
  error?: string
  ok: boolean
  pendingBuildId?: string
}

interface AttachmentFormProps {
  agentId: string
  attached: AttachedToolView | null
  entry: ToolCatalogEntry
}

export function AttachmentForm({
  agentId,
  entry,
  attached,
}: AttachmentFormProps) {
  const buildPhase = toolCatalogBuildPhase(attached)
  const isAttached = buildPhase !== 'detached'
  const [pending, startTransition] = useTransition()
  const { refresh } = useRouter()
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
      const result = await attachTool(agentId, entry.toolId, config)
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
      refresh()
    })
  }

  function handleClearOverride(connectorId: string) {
    const config = buildToolConfig(entry, values, {
      clearCredentialOverrideConnector: connectorId,
    })
    startTransition(async () => {
      const result = await attachTool(agentId, entry.toolId, config)
      if (!result.ok) {
        toast.error(result.error ?? 'Clear override failed.')
        return
      }
      toast.success('Credential override cleared.')
      setOpen(false)
      refresh()
    })
  }

  const handleAttachSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    handleAttach()
  }

  function handleDetach() {
    startTransition(async () => {
      const result = await detachTool(agentId, entry.toolId)
      if (!result.ok) {
        toast.error(result.error ?? 'Detach failed.')
        return
      }
      toast.success('Tool detached.')
      setOpen(false)
      refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <CatalogActionButtons
        buildPhase={buildPhase}
        hasFields={hasFields}
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
                  <Button
                    className="inline-flex h-8 items-center justify-center border-2 border-foreground px-3 font-bold text-[10px] uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
                    disabled={pending}
                    onClick={() => handleClearOverride(group.connectorId)}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Clear override
                  </Button>
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
          <Button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            disabled={pending}
            size="sm"
            type="submit"
          >
            {submitButtonLabel(pending, isAttached)}
          </Button>
        </form>
      )}
    </div>
  )
}

async function attachTool(
  agentId: string,
  toolId: string,
  config: Record<string, unknown>
): Promise<ToolMutationResult> {
  const res = await fetch(toolEndpoint(agentId, toolId), {
    body: JSON.stringify({ config }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  return await readToolMutationResult(res)
}

async function detachTool(
  agentId: string,
  toolId: string
): Promise<ToolMutationResult> {
  const res = await fetch(toolEndpoint(agentId, toolId), {
    method: 'DELETE',
  })
  return await readToolMutationResult(res)
}

async function readToolMutationResult(
  res: Response
): Promise<ToolMutationResult> {
  const body = (await res.json().catch(() => null)) as ToolMutationResult | null
  if (body && typeof body.ok === 'boolean') {
    return body
  }
  return { ok: false, error: `Request failed (${res.status})` }
}

function toolEndpoint(agentId: string, toolId: string): string {
  return `/api/agents/${encodeURIComponent(agentId)}/tools/${encodeURIComponent(toolId)}`
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
