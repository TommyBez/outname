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

interface Zod4Def {
  defaultValue?: unknown
  innerType?: z.ZodTypeAny
  shape?: Record<string, z.ZodTypeAny>
  type?: string
}

function getDef(schema: z.ZodTypeAny): Zod4Def | undefined {
  return (schema as unknown as { _def?: Zod4Def })._def
}

// Zod exposes no stable public introspection API here, so this stays
// best-effort and reads the Zod 4 `_def` shape directly.
function unwrap(schema: z.ZodTypeAny): {
  inner: z.ZodTypeAny
  optional: boolean
  defaultValue: unknown
} {
  let s: z.ZodTypeAny = schema
  let optional = false
  let defaultValue: unknown
  for (let i = 0; i < 8; i++) {
    const def = getDef(s)
    if (!def) {
      break
    }
    if (def.type === 'optional' || def.type === 'nullable') {
      optional = true
      if (def.innerType) {
        s = def.innerType
      } else {
        break
      }
    } else if (def.type === 'default') {
      optional = true
      try {
        defaultValue = def.defaultValue
      } catch {
        defaultValue = undefined
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
  const def = getDef(inner)
  switch (def?.type) {
    case 'number':
      return 'number'
    case 'boolean':
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
  const def = getDef(schema)
  if (def?.type !== 'object' || !def.shape) {
    return []
  }

  const shape = def.shape
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
