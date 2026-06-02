const SSL_MODES_ALIASED_TO_VERIFY_FULL = new Set([
  'prefer',
  'require',
  'verify-ca',
])

export function normalizeDatabaseUrlForPg(databaseUrl: string): string {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(databaseUrl)
  } catch {
    return databaseUrl
  }

  if (parsedUrl.searchParams.get('uselibpqcompat') === 'true') {
    return databaseUrl
  }

  const sslMode = parsedUrl.searchParams.get('sslmode')?.toLowerCase()
  if (!(sslMode && SSL_MODES_ALIASED_TO_VERIFY_FULL.has(sslMode))) {
    return databaseUrl
  }

  // Preserve pg v8's current secure behavior explicitly and silence the warning.
  parsedUrl.searchParams.set('sslmode', 'verify-full')

  return parsedUrl.toString()
}
