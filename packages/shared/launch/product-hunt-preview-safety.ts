type EnvLike = Record<string, string | undefined>

export function areProductHuntLaunchExternalSideEffectsDisabled(
  env: EnvLike = process.env
): boolean {
  return env.VERCEL === '1' && env.VERCEL_ENV === 'preview'
}

export function createProductHuntPreviewExternalSideEffectSkip() {
  return {
    ok: true,
    skipped:
      'product hunt launch external side effects disabled in Vercel preview',
  } as const
}
