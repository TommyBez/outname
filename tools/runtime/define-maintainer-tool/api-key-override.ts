const API_KEY_OVERRIDE_FIELD = 'apiKeyOverride'

function normalizeApiKeyOverride(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function readApiKeyOverride(config: unknown): string | undefined {
  if (!isConfigRecord(config)) {
    return
  }

  return normalizeApiKeyOverride(config[API_KEY_OVERRIDE_FIELD])
}

export function toConfigRecord(config: unknown): Record<string, unknown> {
  return isConfigRecord(config) ? config : {}
}

export function stripApiKeyOverride(config: unknown): unknown {
  if (!(isConfigRecord(config) && API_KEY_OVERRIDE_FIELD in config)) {
    return config
  }

  const sanitized = { ...config }
  delete sanitized[API_KEY_OVERRIDE_FIELD]
  return sanitized
}

export function withApiKeyOverride(
  config: Record<string, unknown>,
  source: unknown
): Record<string, unknown> {
  const apiKeyOverride = readApiKeyOverride(source)
  if (!apiKeyOverride) {
    return config
  }

  return {
    ...config,
    [API_KEY_OVERRIDE_FIELD]: apiKeyOverride,
  }
}

function isConfigRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
