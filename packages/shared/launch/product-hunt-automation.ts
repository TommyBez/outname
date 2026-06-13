import 'server-only'

import { db } from '@outname/db'
import { waitlistEntry, waitlistLaunchEmailDelivery } from '@outname/db/schema'
import {
  buildProductHuntLandingPath,
  type ProductHuntEmailEventKey,
  productHuntEmailEvents,
} from '@outname/shared/launch/product-hunt'
import { buildEmailWebUrl } from '@outname/shared/server/email-urls'
import { sendProductHuntLaunchEmail } from '@outname/shared/waitlist/server/email'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'

const LAUNCH_RECIPIENT_STATUSES = ['confirmed', 'invited', 'converted'] as const

export interface ProductHuntLaunchAutomationResult {
  events: {
    eventKey: ProductHuntEmailEventKey
    reason?: string
    sent: number
    skipped: boolean
  }[]
  ok: true
}

function isEventActive(
  event: (typeof productHuntEmailEvents)[number],
  now: Date
) {
  const time = now.getTime()
  return (
    time >= Date.parse(event.notBeforeIso) &&
    time <= Date.parse(event.notAfterIso)
  )
}

function createDeliveryId(): string {
  return `wled_${nanoid(12)}`
}

async function listRecipientsWithoutDelivery(input: {
  batchSize: number
  eventKey: ProductHuntEmailEventKey
}) {
  return await db
    .select({
      email: waitlistEntry.email,
      entryId: waitlistEntry.id,
    })
    .from(waitlistEntry)
    .leftJoin(
      waitlistLaunchEmailDelivery,
      and(
        eq(waitlistLaunchEmailDelivery.waitlistEntryId, waitlistEntry.id),
        eq(waitlistLaunchEmailDelivery.eventKey, input.eventKey)
      )
    )
    .where(
      and(
        inArray(waitlistEntry.status, [...LAUNCH_RECIPIENT_STATUSES]),
        isNull(waitlistLaunchEmailDelivery.id)
      )
    )
    .limit(input.batchSize)
}

async function sendEventBatch(input: {
  batchSize: number
  eventKey: ProductHuntEmailEventKey
  productHuntUrl: string | null
}) {
  const recipients = await listRecipientsWithoutDelivery({
    batchSize: input.batchSize,
    eventKey: input.eventKey,
  })
  let sent = 0
  const launchLandingUrl = buildEmailWebUrl(
    buildProductHuntLandingPath(input.eventKey)
  )

  for (const recipient of recipients) {
    const messageId = await sendProductHuntLaunchEmail({
      email: recipient.email,
      eventKey: input.eventKey,
      launchLandingUrl,
      productHuntUrl: input.productHuntUrl,
    })

    await db
      .insert(waitlistLaunchEmailDelivery)
      .values({
        id: createDeliveryId(),
        eventKey: input.eventKey,
        resendMessageId: messageId,
        waitlistEntryId: recipient.entryId,
      })
      .onConflictDoNothing()

    sent += 1
  }

  return sent
}

export async function runProductHuntLaunchAutomation(input: {
  batchSize: number
  now?: Date
  productHuntUrl: string | null
}): Promise<ProductHuntLaunchAutomationResult> {
  const now = input.now ?? new Date()
  const events: ProductHuntLaunchAutomationResult['events'] = []

  for (const event of productHuntEmailEvents) {
    if (!isEventActive(event, now)) {
      events.push({
        eventKey: event.key,
        reason: 'outside_event_window',
        sent: 0,
        skipped: true,
      })
      continue
    }

    if (event.requiresProductHuntUrl && !input.productHuntUrl) {
      events.push({
        eventKey: event.key,
        reason: 'product_hunt_url_missing',
        sent: 0,
        skipped: true,
      })
      continue
    }

    const sent = await sendEventBatch({
      batchSize: input.batchSize,
      eventKey: event.key,
      productHuntUrl: input.productHuntUrl,
    })

    events.push({
      eventKey: event.key,
      sent,
      skipped: false,
    })
  }

  return { events, ok: true }
}
