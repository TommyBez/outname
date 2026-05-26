import 'server-only'
import { z } from 'zod'

export interface ConfigField {
  defaultValue?: string | number | boolean
  description?: string
  label: string
  name: string
  placeholder?: string
  required: boolean
  section?: string
  type: 'text' | 'number' | 'boolean'
}

const SECTION_PREFIX_PATTERN = /^\[Group:\s*([^\]]+)\]\s*/

function splitSection(description?: string): {
  description?: string
  section?: string
} {
  if (!description) {
    return {}
  }
  const match = description.match(SECTION_PREFIX_PATTERN)
  if (!match) {
    return { description }
  }
  return {
    section: match[1]?.trim(),
    description: description.replace(SECTION_PREFIX_PATTERN, '').trim(),
  }
}

function unwrap(schema: z.ZodTypeAny): {
  inner: z.ZodTypeAny
  optional: boolean
  defaultValue: unknown
} {
  let s: z.ZodTypeAny = schema
  let optional = false
  let defaultValue: unknown
  for (let i = 0; i < 8; i++) {
    if (s instanceof z.ZodOptional || s instanceof z.ZodNullable) {
      optional = true
      s = unwrapInnerType(s)
      continue
    }
    if (s instanceof z.ZodDefault) {
      optional = true
      defaultValue = readDefaultValue(s)
      s = unwrapInnerType(s)
      continue
    }
    break
  }
  return { inner: s, optional, defaultValue }
}

function classify(inner: z.ZodTypeAny): 'text' | 'number' | 'boolean' {
  if (inner instanceof z.ZodNumber) {
    return 'number'
  }
  if (inner instanceof z.ZodBoolean) {
    return 'boolean'
  }
  return 'text'
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
  const shape = getShape(schema)
  if (!shape) {
    return []
  }
  const fields: ConfigField[] = []
  for (const [name, raw] of Object.entries(shape)) {
    const { inner, optional, defaultValue } = unwrap(raw)
    const description =
      (raw as unknown as { description?: string }).description ??
      (inner as unknown as { description?: string }).description
    const type = classify(inner)
    const fieldMeta = splitSection(description)

    fields.push({
      name,
      label: humanize(name),
      type,
      description: fieldMeta.description,
      section: fieldMeta.section,
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

function getShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> | null {
  if (schema instanceof z.ZodObject) {
    return schema.shape
  }
  const def = (
    schema as unknown as {
      _def?: {
        shape?:
          | Record<string, z.ZodTypeAny>
          | (() => Record<string, z.ZodTypeAny>)
      }
    }
  )._def
  if (!def?.shape) {
    return null
  }
  return typeof def.shape === 'function' ? def.shape() : def.shape
}

function readDefaultValue(schema: {
  _def?: { defaultValue?: unknown }
}): unknown {
  const def = (
    schema as unknown as {
      _def?: {
        defaultValue?: unknown | (() => unknown)
      }
    }
  )._def
  const value = def?.defaultValue
  if (typeof value === 'function') {
    try {
      return value()
    } catch {
      return
    }
  }
  return value
}

function unwrapInnerType(schema: { unwrap: () => unknown }): z.ZodTypeAny {
  return schema.unwrap() as z.ZodTypeAny
}
