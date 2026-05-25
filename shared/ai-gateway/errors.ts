export const AI_GATEWAY_API_KEY_MISSING_CODE = 'ai_gateway_api_key_missing'

export const AI_GATEWAY_API_KEY_MISSING_MESSAGE =
  'Missing AI Gateway API key. Add your key in Settings before running agents.'

export const AI_GATEWAY_API_KEY_MISSING_STATUS = 428

export function isAiGatewayApiKeyMissingError(
  value: unknown
): value is { error: typeof AI_GATEWAY_API_KEY_MISSING_CODE } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    (value as { error?: string }).error === AI_GATEWAY_API_KEY_MISSING_CODE
  )
}
