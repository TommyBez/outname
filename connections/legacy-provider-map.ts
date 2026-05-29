// Keep this provider mapping in sync with drizzle/0011_connector_connections.sql.
const LEGACY_PROVIDER_TO_CONNECTOR_ID = {
  calcom: 'calcom.api_key',
  context7: 'context7.api_key',
  firecrawl: 'firecrawl.api_key',
  github: 'github.personal_access_token',
  parallel: 'parallel.api_key',
  posthog: 'posthog.api_key',
  resend: 'resend.api_key',
  supabase: 'supabase.personal_access_token',
  typefully: 'typefully.api_key',
  v0: 'v0.api_key',
  vercel: 'vercel.api_token',
  x: 'x.bearer_token',
} as const

export function legacyProviderToConnectorId(value: string): string {
  return (
    LEGACY_PROVIDER_TO_CONNECTOR_ID[
      value as keyof typeof LEGACY_PROVIDER_TO_CONNECTOR_ID
    ] ?? value
  )
}
