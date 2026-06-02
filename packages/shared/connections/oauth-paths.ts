export function connectionOAuthStartPath(connectorId: string): string {
  const params = new URLSearchParams({
    returnTo: '/connections',
  })

  return `/api/connections/oauth/${encodeURIComponent(connectorId)}/start?${params.toString()}`
}
