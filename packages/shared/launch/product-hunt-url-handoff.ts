import 'server-only'

import { db } from '@outname/db'
import { launchFeedback, waitlistEntry } from '@outname/db/schema'
import { and, desc, eq, isNotNull, or } from 'drizzle-orm'
import { PRODUCT_HUNT_LAUNCH } from './product-hunt'
import { extractProductHuntPostUrls } from './product-hunt-url-discovery'

const DEFAULT_PRODUCT_HUNT_URL_HANDOFF_LIMIT = 25
const MAX_PRODUCT_HUNT_URL_HANDOFF_LIMIT = 100

interface ProductHuntUrlHandoffRow {
  referrer: string | null
}

function clampHandoffLimit(value?: number): number {
  if (!(value && Number.isFinite(value))) {
    return DEFAULT_PRODUCT_HUNT_URL_HANDOFF_LIMIT
  }

  return Math.min(
    Math.max(Math.trunc(value), 1),
    MAX_PRODUCT_HUNT_URL_HANDOFF_LIMIT
  )
}

export function collectProductHuntLaunchUrlHandoffs(
  rows: readonly ProductHuntUrlHandoffRow[]
): string[] {
  const urls: string[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    for (const url of extractProductHuntPostUrls(row.referrer)) {
      if (!seen.has(url)) {
        seen.add(url)
        urls.push(url)
      }
    }
  }

  return urls
}

export async function getProductHuntLaunchUrlHandoffCandidates(input?: {
  limit?: number
}): Promise<string[]> {
  const limit = clampHandoffLimit(input?.limit)

  const [feedbackRows, waitlistRows] = await Promise.all([
    db
      .select({ referrer: launchFeedback.referrer })
      .from(launchFeedback)
      .where(
        and(
          eq(launchFeedback.launchKey, PRODUCT_HUNT_LAUNCH.campaign),
          isNotNull(launchFeedback.referrer)
        )
      )
      .orderBy(desc(launchFeedback.createdAt))
      .limit(limit),
    db
      .select({ referrer: waitlistEntry.referrer })
      .from(waitlistEntry)
      .where(
        and(
          isNotNull(waitlistEntry.referrer),
          or(
            eq(waitlistEntry.utmCampaign, PRODUCT_HUNT_LAUNCH.campaign),
            eq(waitlistEntry.source, 'product-hunt')
          )
        )
      )
      .orderBy(desc(waitlistEntry.createdAt))
      .limit(limit),
  ])

  return collectProductHuntLaunchUrlHandoffs([...feedbackRows, ...waitlistRows])
}
