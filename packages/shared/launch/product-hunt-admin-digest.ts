import 'server-only'

import { db } from '@outname/db'
import {
  launchAdminDigestDelivery,
  launchFeedback,
  launchSocialPostDelivery,
  waitlistEntry,
  waitlistLaunchEmailDelivery,
} from '@outname/db/schema'
import type { ProductHuntLaunchDigestSection } from '@outname/email/product-hunt-launch-digest-admin-email'
import type { ProductHuntLaunchAutomationResult } from '@outname/shared/launch/product-hunt-automation'
import { areProductHuntLaunchExternalSideEffectsDisabled } from '@outname/shared/launch/product-hunt-preview-safety'
import type { ProductHuntSocialAutomationResult } from '@outname/shared/launch/product-hunt-social-automation'
import { buildEmailWebUrl } from '@outname/shared/server/email-urls'
import { sendProductHuntLaunchDigestAdminNotification } from '@outname/shared/waitlist/server/email'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { PRODUCT_HUNT_LAUNCH, productHuntEmailEvents } from './product-hunt'

type ProductHuntAdminDigestEventKey =
  | 'launch-day-evening'
  | 'launch-day-start'
  | 'postlaunch-recap'
  | 'prelaunch-readiness'

interface ProductHuntAdminDigestEvent {
  key: ProductHuntAdminDigestEventKey
  label: string
  notAfterIso: string
  notBeforeIso: string
}

interface ProductHuntAdminDigestIssue {
  key: string
  severity: 'failure' | 'warning'
}

interface ProductHuntLaunchSectionFailure {
  error: string
  ok: false
}

export interface ProductHuntLaunchAdminDigestResult {
  digestKey?: ProductHuntAdminDigestEventKey
  messageId?: string | null
  ok: true
  reason?: string
  skipped: boolean
}

const PRODUCT_HUNT_ADMIN_DIGEST_EVENTS = [
  {
    key: 'prelaunch-readiness',
    label: 'Pre-launch readiness digest',
    notAfterIso: '2026-06-15T21:00:00.000Z',
    notBeforeIso: '2026-06-15T10:00:00.000Z',
  },
  {
    key: 'launch-day-start',
    label: 'Launch day first checkpoint',
    notAfterIso: '2026-06-16T13:00:00.000Z',
    notBeforeIso: '2026-06-16T07:30:00.000Z',
  },
  {
    key: 'launch-day-evening',
    label: 'Launch day evening digest',
    notAfterIso: '2026-06-17T07:00:00.000Z',
    notBeforeIso: '2026-06-16T18:30:00.000Z',
  },
  {
    key: 'postlaunch-recap',
    label: 'Post-launch recap digest',
    notAfterIso: PRODUCT_HUNT_LAUNCH.postLaunchEndIso,
    notBeforeIso: '2026-06-17T10:30:00.000Z',
  },
] as const satisfies readonly ProductHuntAdminDigestEvent[]

function createDigestDeliveryId(): string {
  return `ladd_${nanoid(12)}`
}

function rowTotal(row?: { total: number | string | null }): number {
  return Number(row?.total ?? 0)
}

function metric(label: string, value: number | string) {
  return { label, value: String(value) }
}

function isDigestEventDue(event: ProductHuntAdminDigestEvent, now: Date) {
  const time = now.getTime()
  return (
    time >= Date.parse(event.notBeforeIso) &&
    time <= Date.parse(event.notAfterIso)
  )
}

export function getProductHuntAdminDigestEvent(
  now: Date
): ProductHuntAdminDigestEvent | null {
  return (
    PRODUCT_HUNT_ADMIN_DIGEST_EVENTS.find((event) =>
      isDigestEventDue(event, now)
    ) ?? null
  )
}

async function hasSentDigest(digestKey: ProductHuntAdminDigestEventKey) {
  const [row] = await db
    .select({ id: launchAdminDigestDelivery.id })
    .from(launchAdminDigestDelivery)
    .where(
      and(
        eq(launchAdminDigestDelivery.launchKey, PRODUCT_HUNT_LAUNCH.campaign),
        eq(launchAdminDigestDelivery.digestKey, digestKey)
      )
    )
    .limit(1)

  return Boolean(row)
}

async function recordDigestDelivery(input: {
  digestKey: ProductHuntAdminDigestEventKey
  messageId?: string | null
}) {
  await db
    .insert(launchAdminDigestDelivery)
    .values({
      digestKey: input.digestKey,
      id: createDigestDeliveryId(),
      launchKey: PRODUCT_HUNT_LAUNCH.campaign,
      resendMessageId: input.messageId,
    })
    .onConflictDoNothing()
}

function createProductHuntWaitlistFilter() {
  return or(
    eq(waitlistEntry.utmCampaign, PRODUCT_HUNT_LAUNCH.campaign),
    eq(waitlistEntry.source, 'product-hunt')
  )
}

function createCurrentRunSection(input: {
  email: ProductHuntLaunchAutomationResult | ProductHuntLaunchSectionFailure
  issues: readonly ProductHuntAdminDigestIssue[]
  productHuntUrl: string | null
  productHuntUrlSource: string
  social:
    | ProductHuntSocialAutomationResult
    | ProductHuntLaunchSectionFailure
    | { ok: true; skipped: string }
}): ProductHuntLaunchDigestSection {
  const emailSent = input.email.ok
    ? input.email.events.reduce((total, event) => total + event.sent, 0)
    : 0
  const emailFailed = input.email.ok
    ? input.email.events.reduce((total, event) => total + event.failed, 0)
    : 1
  const socialCreated =
    input.social.ok && !('skipped' in input.social)
      ? input.social.posts.filter((post) => !post.skipped).length
      : 0
  let socialSkipped = 0
  if (input.social.ok && !('skipped' in input.social)) {
    socialSkipped = input.social.posts.filter((post) => post.skipped).length
  } else if (!input.social.ok) {
    socialSkipped = 1
  }
  const failures = input.issues.filter(
    (issue) => issue.severity === 'failure'
  ).length

  return {
    label: 'Current cron run',
    metrics: [
      metric('Product Hunt URL source', input.productHuntUrlSource),
      metric('Product Hunt URL', input.productHuntUrl ?? 'Not resolved yet'),
      metric('Issues', input.issues.length),
      metric('Failures', failures),
      metric('Emails sent in this run', emailSent),
      metric('Email failures in this run', emailFailed),
      metric('Social posts created in this run', socialCreated),
      metric('Social posts skipped in this run', socialSkipped),
    ],
  }
}

async function createSnapshotSections(): Promise<
  ProductHuntLaunchDigestSection[]
> {
  const emailEventKeys = productHuntEmailEvents.map((event) => event.key)
  const [
    waitlistTotalRows,
    waitlistStatusRows,
    feedbackTotalRows,
    feedbackTypeRows,
    emailEventRows,
    socialPlatformRows,
  ] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(waitlistEntry)
      .where(createProductHuntWaitlistFilter()),
    db
      .select({
        status: waitlistEntry.status,
        total: sql<number>`count(*)::int`,
      })
      .from(waitlistEntry)
      .where(createProductHuntWaitlistFilter())
      .groupBy(waitlistEntry.status),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(launchFeedback)
      .where(eq(launchFeedback.launchKey, PRODUCT_HUNT_LAUNCH.campaign)),
    db
      .select({
        feedbackType: launchFeedback.feedbackType,
        total: sql<number>`count(*)::int`,
      })
      .from(launchFeedback)
      .where(eq(launchFeedback.launchKey, PRODUCT_HUNT_LAUNCH.campaign))
      .groupBy(launchFeedback.feedbackType),
    db
      .select({
        eventKey: waitlistLaunchEmailDelivery.eventKey,
        total: sql<number>`count(*)::int`,
      })
      .from(waitlistLaunchEmailDelivery)
      .where(inArray(waitlistLaunchEmailDelivery.eventKey, emailEventKeys))
      .groupBy(waitlistLaunchEmailDelivery.eventKey),
    db
      .select({
        platform: launchSocialPostDelivery.platform,
        total: sql<number>`count(*)::int`,
      })
      .from(launchSocialPostDelivery)
      .where(
        eq(launchSocialPostDelivery.launchKey, PRODUCT_HUNT_LAUNCH.campaign)
      )
      .groupBy(launchSocialPostDelivery.platform),
  ])

  const waitlistTotal = rowTotal(waitlistTotalRows[0])
  const feedbackTotal = rowTotal(feedbackTotalRows[0])
  const emailTotal = emailEventRows.reduce(
    (total, row) => total + Number(row.total),
    0
  )
  const socialTotal = socialPlatformRows.reduce(
    (total, row) => total + Number(row.total),
    0
  )

  return [
    {
      label: 'Waitlist',
      metrics: [
        metric('Product Hunt attributed signups', waitlistTotal),
        ...waitlistStatusRows.map((row) =>
          metric(row.status ?? 'unknown', Number(row.total))
        ),
      ],
    },
    {
      label: 'Feedback',
      metrics: [
        metric('Feedback submissions', feedbackTotal),
        ...feedbackTypeRows.map((row) =>
          metric(row.feedbackType ?? 'unknown', Number(row.total))
        ),
      ],
    },
    {
      label: 'Launch email delivery',
      metrics: [
        metric('Launch emails recorded', emailTotal),
        ...emailEventRows.map((row) =>
          metric(row.eventKey ?? 'unknown', Number(row.total))
        ),
      ],
    },
    {
      label: 'Typefully delivery',
      metrics: [
        metric('Social drafts recorded', socialTotal),
        ...socialPlatformRows.map((row) =>
          metric(row.platform ?? 'unknown', Number(row.total))
        ),
      ],
    },
  ]
}

export async function runProductHuntLaunchAdminDigest(input: {
  email: ProductHuntLaunchAutomationResult | ProductHuntLaunchSectionFailure
  issues: readonly ProductHuntAdminDigestIssue[]
  now?: Date
  productHuntUrl: string | null
  productHuntUrlSource: string
  social:
    | ProductHuntSocialAutomationResult
    | ProductHuntLaunchSectionFailure
    | { ok: true; skipped: string }
}): Promise<ProductHuntLaunchAdminDigestResult> {
  if (areProductHuntLaunchExternalSideEffectsDisabled()) {
    return {
      ok: true,
      reason: 'preview_external_side_effects_disabled',
      skipped: true,
    }
  }

  const now = input.now ?? new Date()
  const digestEvent = getProductHuntAdminDigestEvent(now)
  if (!digestEvent) {
    return { ok: true, reason: 'outside_digest_window', skipped: true }
  }

  if (await hasSentDigest(digestEvent.key)) {
    return {
      digestKey: digestEvent.key,
      ok: true,
      reason: 'already_sent',
      skipped: true,
    }
  }

  const sections = [
    createCurrentRunSection(input),
    ...(await createSnapshotSections()),
  ]
  const messageId = await sendProductHuntLaunchDigestAdminNotification({
    digestKey: digestEvent.key,
    digestLabel: digestEvent.label,
    launchPageUrl: buildEmailWebUrl('/product-hunt'),
    productHuntUrl: input.productHuntUrl,
    runAtIso: now.toISOString(),
    sections,
  })

  if (messageId === undefined) {
    return {
      digestKey: digestEvent.key,
      ok: true,
      reason: 'admin_email_missing_or_preview',
      skipped: true,
    }
  }

  await recordDigestDelivery({
    digestKey: digestEvent.key,
    messageId,
  })

  return {
    digestKey: digestEvent.key,
    messageId,
    ok: true,
    skipped: false,
  }
}
