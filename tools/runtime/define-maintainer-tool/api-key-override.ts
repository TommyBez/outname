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
  readonly connectorId: string

  constructor(connectorId: string, message: string) {
    super(message)
    this.connectorId = connectorId
    this.name = 'CredentialOverrideUnavailableError'
  }
}

export async function readCredentialOverride(input: {
  config: unknown
  connectorId: string
}): Promise<RawCredential | undefined> {
  const storedOverride = readStoredCredentialOverride(
    input.config,
    input.connectorId
  )
  if (!storedOverride) {
    return
  }

  const connector = getConnector(input.connectorId)
  if (!connector) {
    throw new CredentialOverrideUnavailableError(
      input.connectorId,
      `Unknown connector: ${input.connectorId}`
    )
  }
  if (connector.authKind !== 'api_key') {
    throw new CredentialOverrideUnavailableError(
      input.connectorId,
      'Credential overrides are only supported for API-key connectors.'
    )
  }

  let decrypted: unknown
  try {
    decrypted = await decryptCredential(storedOverride.encrypted)
  } catch (error) {
    throw new CredentialOverrideUnavailableError(
      input.connectorId,
      error instanceof Error
        ? error.message
        : 'Stored credential override could not decrypt.'
    )
  }
  const parsed = connector.apiKey.formSchema.safeParse(decrypted)
  if (!parsed.success) {
    throw new CredentialOverrideUnavailableError(
      input.connectorId,
      parsed.error.issues[0]?.message ??
        'Stored credential override is invalid.'
    )
  }

  return parsed.data
}

export function hasCredentialOverride(input: {
  config: unknown
  connectorId: string
}): boolean {
  return Boolean(readStoredCredentialOverride(input.config, input.connectorId))
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
    const validation = validateAllowedOverride(input.allowedProviders, provider)
    if (!validation.ok) {
      return validation
    }
    delete nextStoredOverrides[provider]
  }

  for (const [provider, rawOverride] of Object.entries(rawOverrides)) {
    if (overrideRemovals.has(provider)) {
      continue
    }
    const encrypted = await encryptRawCredentialOverride({
      allowedProviders: input.allowedProviders,
      connectorId: provider,
      rawOverride,
    })
    if (!encrypted.ok) {
      return encrypted
    }
    nextStoredOverrides[provider] = encrypted.value
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

function validateAllowedOverride(
  allowedProviders: ReadonlySet<string>,
  connectorId: string
): CredentialOverrideConfigResult {
  if (!allowedProviders.has(connectorId)) {
    return {
      ok: false,
      error: `Credential override is not supported for connector "${connectorId}" on this tool.`,
    }
  }
  return { ok: true, config: {} }
}

async function encryptRawCredentialOverride(input: {
  allowedProviders: ReadonlySet<string>
  connectorId: string
  rawOverride: CredentialOverrideFields
}): Promise<
  { ok: true; value: StoredCredentialOverride } | { error: string; ok: false }
> {
  const validation = validateAllowedOverride(
    input.allowedProviders,
    input.connectorId
  )
  if (!validation.ok) {
    return validation
  }

  const connector = getConnector(input.connectorId)
  if (!connector) {
    return {
      ok: false,
      error: `Unknown credential override connector: ${input.connectorId}.`,
    }
  }
  if (connector.authKind !== 'api_key') {
    return {
      ok: false,
      error: `Credential overrides are not supported for OAuth connector "${input.connectorId}".`,
    }
  }

  const parsed = connector.apiKey.formSchema.safeParse(input.rawOverride)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const issuePath =
      issue && issue.path.length > 0 ? ` (${issue.path.join('.')})` : ''
    return {
      ok: false,
      error: `Invalid ${connector.displayName} credential override${issuePath}: ${issue?.message ?? 'Invalid credential.'}`,
    }
  }

  return {
    ok: true,
    value: {
      encrypted: await encryptCredential(parsed.data),
      version: 1,
    },
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
