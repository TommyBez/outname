import { z } from 'zod'

export function withGroupPrefix(group: string, description: string): string {
  return `[Group: ${group}] ${description}`
}

export function normalizeResourcePathname(base: string, path: string): string {
  return new URL(path, base).pathname
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
