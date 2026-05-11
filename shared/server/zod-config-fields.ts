import 'server-only'
import type { z } from 'zod'

export interface ConfigField {
  defaultValue?: string | number | boolean
  description?: string
  label: string
  name: string
  placeholder?: string
  required: boolean
  type: 'text' | 'number' | 'boolean'
}

// Zod exposes no stable public introspection API here, so this stays
// best-effort and reads `_def` directly.
function unwrap(schema: z.ZodTypeAny): {
  inner: z.ZodTypeAny
  optional: boolean
  defaultValue: unknown
} {
  let s: z.ZodTypeAny = schema
  let optional = false
  let defaultValue: unknown
  for (let i = 0; i < 8; i++) {
    const def = (
      s as unknown as {
        _def?: {
          typeName?: string
          defaultValue?: () => unknown
          innerType?: z.ZodTypeAny
        }
      }
    )._def
    if (!def) {
      break
    }
    if (def.typeName === 'ZodOptional' || def.typeName === 'ZodNullable') {
      optional = true
      if (def.innerType) {
        s = def.innerType
      } else {
        break
      }
    } else if (def.typeName === 'ZodDefault') {
      optional = true
      if (typeof def.defaultValue === 'function') {
        try {
          defaultValue = def.defaultValue()
        } catch {
          defaultValue = undefined
        }
      }
      if (def.innerType) {
        s = def.innerType
      } else {
        break
      }
    } else {
      break
    }
  }
  return { inner: s, optional, defaultValue }
}

function classify(inner: z.ZodTypeAny): 'text' | 'number' | 'boolean' {
  const def = (inner as unknown as { _def?: { typeName?: string } })._def
  switch (def?.typeName) {
    case 'ZodNumber':
      return 'number'
    case 'ZodBoolean':
      return 'boolean'
    default:
      return 'text'
  }
}

function humanize(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function describeConfigSchema(
  schema: z.ZodTypeAny | undefined
): ConfigField[] {
  if (!schema) {
    return []
  }
  const def = (
    schema as unknown as {
      _def?: { typeName?: string; shape?: () => Record<string, z.ZodTypeAny> }
    }
  )._def
  if (def?.typeName !== 'ZodObject' || !def.shape) {
    return []
  }

  const shape = def.shape()
  const fields: ConfigField[] = []
  for (const [name, raw] of Object.entries(shape)) {
    const { inner, optional, defaultValue } = unwrap(raw)
    const description = (raw as unknown as { description?: string }).description
    const type = classify(inner)

    fields.push({
      name,
      label: humanize(name),
      type,
      description,
      defaultValue:
        typeof defaultValue === 'string' ||
        typeof defaultValue === 'number' ||
        typeof defaultValue === 'boolean'
          ? defaultValue
          : undefined,
      required: !optional,
    })
  }
  return fields
}
