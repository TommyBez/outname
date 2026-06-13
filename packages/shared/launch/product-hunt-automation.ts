import 'server-only'

import { db } from '@outname/db'
import { waitlistEntry, waitlistLaunchEmailDelivery } from '@outname/db/schema'
import {
  buildProductHuntLandingPath,
  getProductHuntEmailEventSkipReason,
  type ProductHuntEmailEventKey,
  productHuntEmailEvents,
} from '@outname/shared/launch/product-hunt'
import { areProductHuntLaunchExternalSideEffectsDisabled } from '@outname/shared/launch/product-hunt-preview-safety'
import { buildEmailWebUrl } from '@outname/shared/server/email-urls'
import { sendProductHuntLaunchEmail } from '@outname/shared/waitlist/server/email'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'

const LAUNCH_RECIPIENT_STATUSES = ['confirmed', 'invited', 'converted'] as const

export interface ProductHuntLaunchAutomationResult {
  events: {
    eventKey: ProductHuntEmailEventKey
    failed: number
    reason?: string
    sent: number
    skipped: boolean
  }[]
  ok: true
}

function createDeliveryId(): string {
  return `wled_${nanoid(12)}`
}

function createSkippedLaunchAutomationResult(input: {
  reason: string
}): ProductHuntLaunchAutomationResult {
  return {
    events: productHuntEmailEvents.map((event) => ({
      eventKey: event.key,
      failed: 0,
      reason: input.reason,
      sent: 0,
      skipped: true,
    })),
    ok: true,
  }
}

async function listRecipientsWithoutDelivery(input: {
  batchSize: number
  eventKey: ProductHuntEmailEventKey
  suppressIfDeliveredEventKeys?: readonly ProductHuntEmailEventKey[]
}) {
  const deliveryEventKeys = [
    input.eventKey,
    ...(input.suppressIfDeliveredEventKeys ?? []),
  ]

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
        inArray(waitlistLaunchEmailDelivery.eventKey, deliveryEventKeys)
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
  suppressIfDeliveredEventKeys?: readonly ProductHuntEmailEventKey[]
}) {
  const recipients = await listRecipientsWithoutDelivery({
    batchSize: input.batchSize,
    eventKey: input.eventKey,
    suppressIfDeliveredEventKeys: input.suppressIfDeliveredEventKeys,
  })
  let sent = 0
  const launchLandingUrl = buildEmailWebUrl(
    buildProductHuntLandingPath(input.eventKey)
  )

  for (const recipient of recipients) {
    try {
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
    } catch (error) {
      console.error('[product-hunt-launch-email] recipient failed', {
        entryId: recipient.entryId,
        error,
        eventKey: input.eventKey,
      })
    }
  }

  return {
    failed: recipients.length - sent,
    sent,
  }
}

export async function runProductHuntLaunchAutomation(input: {
  batchSize: number
  now?: Date
  productHuntUrl: string | null
}): Promise<ProductHuntLaunchAutomationResult> {
  if (areProductHuntLaunchExternalSideEffectsDisabled()) {
    return createSkippedLaunchAutomationResult({
      reason: 'preview_external_side_effects_disabled',
    })
  }

  const now = input.now ?? new Date()
  const events: ProductHuntLaunchAutomationResult['events'] = []

  for (const event of productHuntEmailEvents) {
    const skipReason = getProductHuntEmailEventSkipReason({
      event,
      now,
      productHuntUrl: input.productHuntUrl,
    })
    if (skipReason) {
      events.push({
        eventKey: event.key,
        failed: 0,
        reason: skipReason,
        sent: 0,
        skipped: true,
      })
      continue
    }

    const batch = await sendEventBatch({
      batchSize: input.batchSize,
      eventKey: event.key,
      productHuntUrl: input.productHuntUrl,
      suppressIfDeliveredEventKeys:
        'suppressIfDeliveredEventKeys' in event
          ? event.suppressIfDeliveredEventKeys
          : undefined,
    })

    events.push({
      eventKey: event.key,
      failed: batch.failed,
      sent: batch.sent,
      skipped: false,
    })
  }

  return { events, ok: true }
}
