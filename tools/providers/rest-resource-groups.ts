import { z } from 'zod'

const RESOURCE_FIELD_SEPARATOR_PATTERN = /[^a-zA-Z0-9]+/

export interface RestResourceDefinition {
  defaultReadOnly?: boolean
  enableDescription?: string
  key: string
  label: string
  readOnlyDescription?: string
}

export function withGroupPrefix(group: string, description: string): string {
  return `[Group: ${group}] ${description}`
}

export function normalizeResourcePathname(base: string, path: string): string {
  return new URL(path, base).pathname
}

function toResourceFieldSuffix(key: string): string {
  return key
    .split(RESOURCE_FIELD_SEPARATOR_PATTERN)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join('')
}

export function resourceConfigFieldName(args: {
  kind: 'enable' | 'readOnly'
  resource: RestResourceDefinition
}): string {
  const suffix = toResourceFieldSuffix(args.resource.key)
  return args.kind === 'enable'
    ? `enableGroup${suffix}`
    : `readOnlyGroup${suffix}`
}

export function enforceGroupAccess(args: {
  enabled: boolean
  group: string
  readOnly: boolean
  method: string
  globalReadOnly: boolean
}): { ok: true } | { ok: false; message: string } {
  if (!args.enabled) {
    return {
      ok: false,
      message: `The ${args.group} resource group is disabled for this attachment.`,
    }
  }
  const method = (args.method || '').toUpperCase()
  const isSafeMethod =
    method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
  if ((args.globalReadOnly || args.readOnly) && !isSafeMethod) {
    return {
      ok: false,
      message: `This attachment blocks mutating ${args.group.toLowerCase()} operations.`,
    }
  }
  return { ok: true }
}

export function buildResourceConfigShape(
  resources: readonly RestResourceDefinition[]
): Record<string, z.ZodTypeAny> {
  return Object.fromEntries(
    resources.flatMap((resource) => [
      [
        resourceConfigFieldName({ kind: 'enable', resource }),
        groupToggleField(
          resource.label,
          resource.enableDescription ??
            `Enable ${resource.label.toLowerCase()} endpoints.`
        ),
      ],
      [
        resourceConfigFieldName({ kind: 'readOnly', resource }),
        groupReadOnlyField(
          resource.label,
          resource.readOnlyDescription ??
            `When true, ${resource.label.toLowerCase()} endpoints are read-only.`,
          resource.defaultReadOnly ?? true
        ),
      ],
    ])
  )
}

export function findResourceDefinition(
  resources: readonly RestResourceDefinition[],
  key: string
): RestResourceDefinition | null {
  return resources.find((resource) => resource.key === key) ?? null
}

function readResourceConfigValue(args: {
  config: Record<string, unknown>
  fallback: boolean
  kind: 'enable' | 'readOnly'
  resource: RestResourceDefinition
}): boolean {
  const value =
    args.config[
      resourceConfigFieldName({ kind: args.kind, resource: args.resource })
    ]
  return typeof value === 'boolean' ? value : args.fallback
}

export function enforceResourceAccess(args: {
  config: Record<string, unknown>
  globalReadOnly: boolean
  method: string
  resource: RestResourceDefinition
}): { ok: true } | { ok: false; message: string } {
  return enforceGroupAccess({
    enabled: readResourceConfigValue({
      config: args.config,
      fallback: true,
      kind: 'enable',
      resource: args.resource,
    }),
    globalReadOnly: args.globalReadOnly,
    group: args.resource.label,
    method: args.method,
    readOnly: readResourceConfigValue({
      config: args.config,
      fallback: args.resource.defaultReadOnly ?? true,
      kind: 'readOnly',
      resource: args.resource,
    }),
  })
}

export const groupToggleField = (group: string, description: string) =>
  z.boolean().default(true).describe(withGroupPrefix(group, description))

export const groupReadOnlyField = (
  group: string,
  description: string,
  defaultValue = true
) =>
  z
    .boolean()
    .default(defaultValue)
    .describe(withGroupPrefix(group, description))
