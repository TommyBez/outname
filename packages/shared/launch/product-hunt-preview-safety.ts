const ENABLED_VALUES = new Set(['1', 'true', 'yes'])

function isTruthyEnv(value: string | undefined): boolean {
  return ENABLED_VALUES.has(value?.trim().toLowerCase() ?? '')
}

export function areProductHuntLaunchSideEffectsDisabled(): boolean {
  if (isTruthyEnv(process.env.PRODUCT_HUNT_ALLOW_PREVIEW_SIDE_EFFECTS)) {
    return false
  }

  return process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'preview'
}

export function createProductHuntPreviewSideEffectSkip() {
  return {
    ok: true,
    skipped: 'product hunt launch side effects disabled in Vercel preview',
  } as const
}
