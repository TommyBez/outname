export function areProductHuntLaunchExternalSideEffectsDisabled(): boolean {
  return process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'preview'
}

export function createProductHuntPreviewExternalSideEffectSkip() {
  return {
    ok: true,
    skipped:
      'product hunt launch external side effects disabled in Vercel preview',
  } as const
}
