const REASON_COPY: Array<{ match: RegExp; message: string }> = [
  {
    match: /access_denied/i,
    message:
      'The authorization request was declined. If that was unintentional, start the connection again and approve access.',
  },
  {
    match: /invalid state|state mismatch/i,
    message:
      'The sign-in flow expired or was opened in a different browser session. Start the connection again from this page.',
  },
  {
    match: /pkce/i,
    message:
      'The sign-in flow could not be verified. Start the connection again from this page.',
  },
  {
    match: /invalid_grant|expired/i,
    message:
      'The authorization expired before it completed. Start the connection again and finish the approval promptly.',
  },
  {
    match: /scope/i,
    message:
      'The provider did not grant the permissions this integration needs. Reconnect and approve all requested permissions.',
  },
]

/**
 * Maps raw OAuth callback failure reasons (e.g. "oauth: access_denied") to
 * copy a person can act on. The raw reason should still be shown as a
 * secondary detail for debugging.
 */
export function humanizeConnectionFlashReason(
  reason: string | undefined
): string {
  if (!reason) {
    return 'Something went wrong while connecting. Start the connection again — if it keeps failing, the provider may be having issues.'
  }
  const entry = REASON_COPY.find((candidate) => candidate.match.test(reason))
  return (
    entry?.message ??
    'Something went wrong while connecting. Start the connection again — if it keeps failing, the provider may be having issues.'
  )
}
