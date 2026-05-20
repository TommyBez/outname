import 'server-only'

import { decryptCredential, encryptCredential } from '@/connections/crypto'

const API_KEY_OVERRIDE_FIELD = 'apiKeyOverride'
const SECRETS_FIELD = '_secrets'
const ENCRYPTED_API_KEY_OVERRIDE_FIELD = 'apiKeyOverride'

interface StoredApiKeyOverride {
  encrypted: string
  version: 1
}

function normalizeApiKeyOverride(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function readPlainApiKeyOverride(config: unknown): string | undefined {
  if (!isConfigRecord(config)) {
    return
  }

  return normalizeApiKeyOverride(config[API_KEY_OVERRIDE_FIELD])
}

export async function readApiKeyOverride(
  config: unknown
): Promise<string | undefined> {
  const plainOverride = readPlainApiKeyOverride(config)
  if (plainOverride) {
    return plainOverride
  }

  const storedOverride = readStoredApiKeyOverride(config)
  if (!storedOverride) {
    return
  }

  return await decryptCredential<string>(storedOverride.encrypted)
}

export function toConfigRecord(config: unknown): Record<string, unknown> {
  return isConfigRecord(config) ? config : {}
}

export function stripApiKeyOverride(config: unknown): unknown {
  if (!isConfigRecord(config)) {
    return config
  }

  const sanitized = { ...config }
  delete sanitized[API_KEY_OVERRIDE_FIELD]
  delete sanitized[SECRETS_FIELD]
  return sanitized
}

export function redactApiKeyOverride(config: unknown): Record<string, unknown> {
  return toConfigRecord(stripApiKeyOverride(config))
}

export async function withEncryptedApiKeyOverride(
  config: Record<string, unknown>,
  source: unknown,
  fallbackSource?: unknown
): Promise<Record<string, unknown>> {
  const apiKeyOverride = readPlainApiKeyOverride(source)
  if (!apiKeyOverride) {
    return withStoredApiKeyOverride(config, fallbackSource)
  }

  const storedOverride: StoredApiKeyOverride = {
    encrypted: await encryptCredential(apiKeyOverride),
    version: 1,
  }

  return withStoredApiKeyOverride(config, {
    [SECRETS_FIELD]: {
      [ENCRYPTED_API_KEY_OVERRIDE_FIELD]: storedOverride,
    },
  })
}

export function withStoredApiKeyOverride(
  config: Record<string, unknown>,
  source: unknown
): Record<string, unknown> {
  const storedOverride = readStoredApiKeyOverride(source)
  if (!storedOverride) {
    return config
  }
  return {
    ...config,
    [SECRETS_FIELD]: {
      [ENCRYPTED_API_KEY_OVERRIDE_FIELD]: storedOverride,
    },
  }
}

function readStoredApiKeyOverride(
  config: unknown
): StoredApiKeyOverride | undefined {
  if (!isConfigRecord(config)) {
    return
  }
  const secrets = config[SECRETS_FIELD]
  if (!isConfigRecord(secrets)) {
    return
  }
  const stored = secrets[ENCRYPTED_API_KEY_OVERRIDE_FIELD]
  if (!isConfigRecord(stored)) {
    return
  }
  return stored.version === 1 && typeof stored.encrypted === 'string'
    ? {
        encrypted: stored.encrypted,
        version: 1,
      }
    : undefined
}

function isConfigRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
