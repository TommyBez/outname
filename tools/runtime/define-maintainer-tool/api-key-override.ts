import 'server-only'

import { decryptCredential, encryptCredential } from '@/connections/crypto'
import { getConnector } from '@/connections/registry'
import type { RawCredential } from '@/connections/types'

const LEGACY_API_KEY_OVERRIDE_FIELD = 'apiKeyOverride'
const CREDENTIAL_OVERRIDES_FIELD = 'credentialOverrides'
const CREDENTIAL_OVERRIDE_REMOVALS_FIELD = 'credentialOverrideRemovals'
const SECRETS_FIELD = '_secrets'
const STORED_CREDENTIAL_OVERRIDES_FIELD = 'credentialOverrides'

interface StoredCredentialOverride {
  encrypted: string
  version: 1
}

type StoredCredentialOverrides = Record<string, StoredCredentialOverride>
type CredentialOverrideFields = Record<string, string>
type CredentialOverrideInput = Record<string, CredentialOverrideFields>

export type CredentialOverrideConfigResult =
  | { config: Record<string, unknown>; ok: true }
  | { error: string; ok: false }

export class CredentialOverrideUnavailableError extends Error {
  readonly code = 'connection_unavailable' as const
  readonly provider: string

  constructor(provider: string, message: string) {
    super(message)
    this.provider = provider
    this.name = 'CredentialOverrideUnavailableError'
  }
}

export async function readCredentialOverride(input: {
  config: unknown
  provider: string
}): Promise<RawCredential | undefined> {
  const storedOverride = readStoredCredentialOverride(
    input.config,
    input.provider
  )
  if (!storedOverride) {
    return
  }

  const connector = getConnector(input.provider)
  if (!connector) {
    throw new CredentialOverrideUnavailableError(
      input.provider,
      `Unknown provider: ${input.provider}`
    )
  }

  let decrypted: unknown
  try {
    decrypted = await decryptCredential(storedOverride.encrypted)
  } catch (error) {
    throw new CredentialOverrideUnavailableError(
      input.provider,
      error instanceof Error
        ? error.message
        : 'Stored credential override could not decrypt.'
    )
  }
  const parsed = connector.apiKey.formSchema.safeParse(decrypted)
  if (!parsed.success) {
    throw new CredentialOverrideUnavailableError(
      input.provider,
      parsed.error.issues[0]?.message ??
        'Stored credential override is invalid.'
    )
  }

  return parsed.data
}

export function hasCredentialOverride(input: {
  config: unknown
  provider: string
}): boolean {
  return Boolean(readStoredCredentialOverride(input.config, input.provider))
}

export function toConfigRecord(config: unknown): Record<string, unknown> {
  return isConfigRecord(config) ? config : {}
}

export function stripCredentialOverrides(config: unknown): unknown {
  if (!isConfigRecord(config)) {
    return config
  }

  const sanitized = { ...config }
  delete sanitized[CREDENTIAL_OVERRIDES_FIELD]
  delete sanitized[CREDENTIAL_OVERRIDE_REMOVALS_FIELD]
  delete sanitized[LEGACY_API_KEY_OVERRIDE_FIELD]
  delete sanitized[SECRETS_FIELD]
  return sanitized
}

export function redactCredentialOverrides(
  config: unknown
): Record<string, unknown> {
  return toConfigRecord(stripCredentialOverrides(config))
}

export async function withEncryptedCredentialOverrides(input: {
  allowedProviders: ReadonlySet<string>
  config: Record<string, unknown>
  fallbackSource?: unknown
  source: unknown
}): Promise<CredentialOverrideConfigResult> {
  const rawOverrides = readRawCredentialOverrides(input.source)
  const overrideRemovals = readCredentialOverrideRemovals(input.source)
  const storedOverrides = readStoredCredentialOverrides(input.fallbackSource)
  const nextStoredOverrides: StoredCredentialOverrides = {}

  for (const [provider, storedOverride] of Object.entries(storedOverrides)) {
    if (input.allowedProviders.has(provider)) {
      nextStoredOverrides[provider] = storedOverride
    }
  }

  for (const provider of overrideRemovals) {
    if (!input.allowedProviders.has(provider)) {
      return {
        ok: false,
        error: `Credential override is not supported for provider "${provider}" on this tool.`,
      }
    }
    delete nextStoredOverrides[provider]
  }

  for (const [provider, rawOverride] of Object.entries(rawOverrides)) {
    if (overrideRemovals.has(provider)) {
      continue
    }
    if (!input.allowedProviders.has(provider)) {
      return {
        ok: false,
        error: `Credential override is not supported for provider "${provider}" on this tool.`,
      }
    }

    const connector = getConnector(provider)
    if (!connector) {
      return {
        ok: false,
        error: `Unknown credential override provider: ${provider}.`,
      }
    }

    const parsed = connector.apiKey.formSchema.safeParse(rawOverride)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const issuePath =
        issue && issue.path.length > 0 ? ` (${issue.path.join('.')})` : ''
      return {
        ok: false,
        error: `Invalid ${connector.displayName} credential override${issuePath}: ${issue?.message ?? 'Invalid credential.'}`,
      }
    }

    nextStoredOverrides[provider] = {
      encrypted: await encryptCredential(parsed.data),
      version: 1,
    }
  }

  return {
    ok: true,
    config: withStoredCredentialOverrides(input.config, {
      [SECRETS_FIELD]: {
        [STORED_CREDENTIAL_OVERRIDES_FIELD]: nextStoredOverrides,
      },
    }),
  }
}

export function withStoredCredentialOverrides(
  config: Record<string, unknown>,
  source: unknown,
  allowedProviders?: ReadonlySet<string>
): Record<string, unknown> {
  const storedOverrides = readStoredCredentialOverrides(source)
  const filteredOverrides: StoredCredentialOverrides = {}

  for (const [provider, storedOverride] of Object.entries(storedOverrides)) {
    if (!allowedProviders || allowedProviders.has(provider)) {
      filteredOverrides[provider] = storedOverride
    }
  }

  if (Object.keys(filteredOverrides).length === 0) {
    return config
  }

  return {
    ...config,
    [SECRETS_FIELD]: {
      [STORED_CREDENTIAL_OVERRIDES_FIELD]: filteredOverrides,
    },
  }
}

function readRawCredentialOverrides(source: unknown): CredentialOverrideInput {
  if (!isConfigRecord(source)) {
    return {}
  }

  const rawOverrides = source[CREDENTIAL_OVERRIDES_FIELD]
  if (!isConfigRecord(rawOverrides)) {
    return {}
  }

  const overrides: CredentialOverrideInput = {}
  for (const [provider, value] of Object.entries(rawOverrides)) {
    if (!isConfigRecord(value)) {
      continue
    }

    const fields: CredentialOverrideFields = {}
    for (const [fieldName, rawFieldValue] of Object.entries(value)) {
      if (
        typeof rawFieldValue === 'string' &&
        rawFieldValue.trim().length > 0
      ) {
        fields[fieldName] = rawFieldValue
      }
    }

    if (Object.keys(fields).length > 0) {
      overrides[provider] = fields
    }
  }

  return overrides
}

function readCredentialOverrideRemovals(source: unknown): Set<string> {
  if (!isConfigRecord(source)) {
    return new Set()
  }

  const rawRemovals = source[CREDENTIAL_OVERRIDE_REMOVALS_FIELD]
  if (!Array.isArray(rawRemovals)) {
    return new Set()
  }

  const removals = new Set<string>()
  for (const rawProvider of rawRemovals) {
    if (typeof rawProvider === 'string' && rawProvider.trim().length > 0) {
      removals.add(rawProvider.trim())
    }
  }
  return removals
}

function readStoredCredentialOverride(
  config: unknown,
  provider: string
): StoredCredentialOverride | undefined {
  return readStoredCredentialOverrides(config)[provider]
}

function readStoredCredentialOverrides(
  config: unknown
): StoredCredentialOverrides {
  if (!isConfigRecord(config)) {
    return {}
  }

  const secrets = config[SECRETS_FIELD]
  if (!isConfigRecord(secrets)) {
    return {}
  }

  const storedOverrides = secrets[STORED_CREDENTIAL_OVERRIDES_FIELD]
  if (!isConfigRecord(storedOverrides)) {
    return {}
  }

  const overrides: StoredCredentialOverrides = {}
  for (const [provider, stored] of Object.entries(storedOverrides)) {
    if (!isConfigRecord(stored)) {
      continue
    }
    if (stored.version === 1 && typeof stored.encrypted === 'string') {
      overrides[provider] = {
        encrypted: stored.encrypted,
        version: 1,
      }
    }
  }

  return overrides
}

function isConfigRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
