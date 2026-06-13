export const PRODUCT_HUNT_LAUNCH = {
  campaign: 'vercel-day-2026',
  launchDateLabel: 'Tuesday, June 16, 2026',
  launchStartIso: '2026-06-16T07:01:00.000Z',
  launchEndIso: '2026-06-17T07:00:00.000Z',
  postLaunchEndIso: '2026-06-20T07:00:00.000Z',
  localLaunchTimeLabel: '09:01 CEST',
  pacificLaunchTimeLabel: '12:01 AM Pacific',
  productHuntTag: 'Vercel Day',
  title: 'OUTNA.ME on Product Hunt',
} as const

export type ProductHuntLaunchPhase =
  | 'ended'
  | 'live'
  | 'postlaunch'
  | 'prelaunch'

export interface ProductHuntLaunchState {
  launchUrl: string | null
  phase: ProductHuntLaunchPhase
}

export const productHuntTopics = [
  'Vercel Day',
  'AI Agents',
  'Productivity',
] as const

export const productHuntStackHighlights = [
  {
    label: 'Vercel Sandbox',
    text: 'Agent work runs in isolated, persistent environments instead of touching production state directly.',
  },
  {
    label: 'Vercel Workflow',
    text: 'Scheduled and long-running agent work can survive retries, reconnects, and deploys.',
  },
  {
    label: 'AI SDK',
    text: 'Model calls, tools, streaming, and provider routing use the same TypeScript surface.',
  },
  {
    label: 'Chat SDK',
    text: 'The same agent logic can show up in browser chat and operational channels.',
  },
] as const

export const productHuntSocialImage = {
  alt: 'OUTNA.ME Product Hunt Vercel Day preview showing hosted AI agents with Vercel Sandbox, Workflow, AI SDK, and Chat SDK.',
  height: 760,
  url: '/product-hunt-vercel-day/01-outname-hero.png',
  width: 1270,
} as const

export const productHuntFaq = [
  {
    question: 'What is OUTNA.ME?',
    answer:
      'OUTNA.ME is a hosted product for creating personal AI agents with memory, schedules, tools, channels, and sandboxed execution.',
  },
  {
    question: 'Who is it for?',
    answer:
      'It is for solo builders, operators, technical leaders, and developers who want recurring work to keep moving without maintaining their own agent stack.',
  },
  {
    question: 'Why is this a Vercel Day launch?',
    answer:
      'OUTNA.ME uses Vercel Sandbox, Vercel Workflow, the Vercel AI SDK, and the Vercel Chat SDK as core runtime pieces.',
  },
  {
    question: 'Is OUTNA.ME open source?',
    answer:
      'Yes. The codebase is MIT licensed. The hosted product is the default path, while open source supports inspection, contribution, and optional self-deployment.',
  },
] as const

export const productHuntEmailEvents = [
  {
    key: 'vercel-day-reminder',
    notAfterIso: '2026-06-15T20:00:00.000Z',
    notBeforeIso: '2026-06-15T08:30:00.000Z',
    requiresProductHuntUrl: false,
  },
  {
    key: 'vercel-day-live',
    notAfterIso: '2026-06-16T20:00:00.000Z',
    notBeforeIso: '2026-06-16T07:05:00.000Z',
    requiresProductHuntUrl: true,
    suppressIfDeliveredEventKeys: ['vercel-day-live-fallback'],
  },
  {
    key: 'vercel-day-live-fallback',
    notAfterIso: '2026-06-16T20:00:00.000Z',
    notBeforeIso: '2026-06-16T08:15:00.000Z',
    requiresProductHuntUrl: false,
    skipWhenProductHuntUrlPresent: true,
    suppressIfDeliveredEventKeys: ['vercel-day-live'],
  },
  {
    key: 'vercel-day-recap',
    notAfterIso: '2026-06-17T18:00:00.000Z',
    notBeforeIso: '2026-06-17T08:30:00.000Z',
    requiresProductHuntUrl: true,
    suppressIfDeliveredEventKeys: ['vercel-day-recap-fallback'],
  },
  {
    key: 'vercel-day-recap-fallback',
    notAfterIso: '2026-06-17T18:00:00.000Z',
    notBeforeIso: '2026-06-17T10:00:00.000Z',
    requiresProductHuntUrl: false,
    skipWhenProductHuntUrlPresent: true,
    suppressIfDeliveredEventKeys: ['vercel-day-recap'],
  },
] as const

export type ProductHuntEmailEventKey =
  (typeof productHuntEmailEvents)[number]['key']

export type ProductHuntEmailEvent = (typeof productHuntEmailEvents)[number]

export type ProductHuntEmailEventSkipReason =
  | 'outside_event_window'
  | 'product_hunt_url_missing'
  | 'product_hunt_url_present'

const PRODUCT_HUNT_DEFAULT_BATCH_SIZE = 50
const PRODUCT_HUNT_MAX_BATCH_SIZE = 200

export function buildProductHuntWaitlistPath(utmContent: string): string {
  const params = new URLSearchParams({
    source: 'product-hunt',
    utm_campaign: PRODUCT_HUNT_LAUNCH.campaign,
    utm_content: utmContent,
    utm_medium: 'launch',
    utm_source: 'producthunt',
  })

  return `/waitlist?${params.toString()}`
}

export function buildProductHuntLandingPath(utmContent: string): string {
  const params = new URLSearchParams({
    utm_campaign: PRODUCT_HUNT_LAUNCH.campaign,
    utm_content: utmContent,
    utm_medium: 'launch',
    utm_source: 'producthunt',
  })

  return `/product-hunt?${params.toString()}`
}

export function getProductHuntLaunchPhase(
  now: Date = new Date()
): ProductHuntLaunchPhase {
  const time = now.getTime()
  const launchStart = Date.parse(PRODUCT_HUNT_LAUNCH.launchStartIso)
  const launchEnd = Date.parse(PRODUCT_HUNT_LAUNCH.launchEndIso)
  const postLaunchEnd = Date.parse(PRODUCT_HUNT_LAUNCH.postLaunchEndIso)

  if (time < launchStart) {
    return 'prelaunch'
  }
  if (time <= launchEnd) {
    return 'live'
  }
  if (time <= postLaunchEnd) {
    return 'postlaunch'
  }
  return 'ended'
}

export function createProductHuntLaunchState(input?: {
  now?: Date
  productHuntUrl?: string | null
}): ProductHuntLaunchState {
  return {
    launchUrl: normalizeProductHuntLaunchUrl(input?.productHuntUrl),
    phase: getProductHuntLaunchPhase(input?.now),
  }
}

export function getProductHuntEmailEventSkipReason(input: {
  event: ProductHuntEmailEvent
  now: Date
  productHuntUrl: string | null
}): ProductHuntEmailEventSkipReason | null {
  const time = input.now.getTime()

  if (
    time < Date.parse(input.event.notBeforeIso) ||
    time > Date.parse(input.event.notAfterIso)
  ) {
    return 'outside_event_window'
  }

  if (input.event.requiresProductHuntUrl && !input.productHuntUrl) {
    return 'product_hunt_url_missing'
  }

  if (
    'skipWhenProductHuntUrlPresent' in input.event &&
    input.event.skipWhenProductHuntUrlPresent &&
    input.productHuntUrl
  ) {
    return 'product_hunt_url_present'
  }

  return null
}

export function isProductHuntLaunchVisible(
  state: ProductHuntLaunchState | null | undefined
): state is ProductHuntLaunchState {
  return Boolean(state && state.phase !== 'ended')
}

export function normalizeProductHuntLaunchUrl(
  value?: string | null
): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function parseProductHuntBatchSize(value?: string): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return PRODUCT_HUNT_DEFAULT_BATCH_SIZE
  }
  return Math.min(parsed, PRODUCT_HUNT_MAX_BATCH_SIZE)
}
