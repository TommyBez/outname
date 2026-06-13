import { createHash } from 'node:crypto'
import { withRedisLock } from '@outname/ai/agent-runtime/server/redis-lock'
import {
  normalizeProductHuntLaunchUrl,
  PRODUCT_HUNT_LAUNCH,
  parseProductHuntBatchSize,
} from '@outname/shared/launch/product-hunt'
import {
  type ProductHuntLaunchAutomationResult,
  runProductHuntLaunchAutomation,
} from '@outname/shared/launch/product-hunt-automation'
import {
  areProductHuntLaunchExternalSideEffectsDisabled,
  createProductHuntPreviewExternalSideEffectSkip,
} from '@outname/shared/launch/product-hunt-preview-safety'
import { getProductHuntLaunchReadiness } from '@outname/shared/launch/product-hunt-readiness'
import {
  type ProductHuntSocialAutomationResult,
  runProductHuntSocialAutomation,
} from '@outname/shared/launch/product-hunt-social-automation'
import { resolveProductHuntLaunchUrl } from '@outname/shared/launch/product-hunt-url-discovery'
import { sendProductHuntLaunchIssueAdminNotification } from '@outname/shared/waitlist/server/email'
import { connection, type NextRequest, NextResponse } from 'next/server'

function getNullableEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

interface ProductHuntLaunchSectionFailure {
  error: string
  ok: false
}

interface ProductHuntLaunchIssue {
  details?: string[]
  key: string
  message: string
  severity: 'failure' | 'warning'
}

const ALERTABLE_SOCIAL_SKIP_REASONS = new Set([
  'post_window_expired',
  'typefully_connection_missing',
  'typefully_request_failed',
  'typefully_setup_failed',
  'typefully_social_set_missing',
])

function createSectionFailure(error: unknown): ProductHuntLaunchSectionFailure {
  return {
    error: error instanceof Error ? error.message : 'Unknown error',
    ok: false,
  }
}

function createIssueDedupeKey(input: {
  issues: ProductHuntLaunchIssue[]
  now: Date
}): string {
  const issueSignature = input.issues.map((issue) => ({
    details: issue.details,
    key: issue.key,
    message: issue.message,
    severity: issue.severity,
  }))
  const signatureHash = createHash('sha256')
    .update(JSON.stringify(issueSignature))
    .digest('hex')
    .slice(0, 12)
  const hourBucket = input.now.toISOString().slice(0, 13)

  return `${PRODUCT_HUNT_LAUNCH.campaign}/${hourBucket}/${signatureHash}`
}

function collectEmailIssues(
  email: ProductHuntLaunchAutomationResult | ProductHuntLaunchSectionFailure
): ProductHuntLaunchIssue[] {
  if (!email.ok) {
    return [
      {
        details: [email.error],
        key: 'product_hunt_email_section',
        message: 'Product Hunt email automation failed before completing.',
        severity: 'failure',
      },
    ]
  }

  const failedEvents = email.events
    .filter((event) => event.failed > 0)
    .map(
      (event) => `${event.eventKey} failed for ${event.failed} recipient(s).`
    )

  if (failedEvents.length === 0) {
    return []
  }

  return [
    {
      details: failedEvents,
      key: 'product_hunt_email_delivery',
      message: 'Product Hunt email automation reported recipient failures.',
      severity: 'warning',
    },
  ]
}

function collectSocialIssues(
  social:
    | ProductHuntSectionSkipped
    | ProductHuntSocialAutomationResult
    | ProductHuntLaunchSectionFailure
): ProductHuntLaunchIssue[] {
  if (!social.ok) {
    return [
      {
        details: [social.error],
        key: 'product_hunt_social_section',
        message: 'Product Hunt social automation failed before completing.',
        severity: 'failure',
      },
    ]
  }

  if ('skipped' in social) {
    return []
  }

  const alertablePosts = social.posts
    .filter(
      (post) =>
        post.skipped &&
        post.reason &&
        ALERTABLE_SOCIAL_SKIP_REASONS.has(post.reason)
    )
    .map((post) =>
      post.error
        ? `${post.reason}: ${post.postId} (${post.error})`
        : `${post.reason}: ${post.postId}`
    )

  if (alertablePosts.length === 0) {
    return []
  }

  const severity = alertablePosts.every((detail) =>
    detail.startsWith('post_window_expired:')
  )
    ? 'warning'
    : 'failure'

  return [
    {
      details: alertablePosts,
      key: 'product_hunt_social_posts',
      message:
        'Product Hunt social automation skipped posts for alertable reasons.',
      severity,
    },
  ]
}

interface ProductHuntSectionSkipped {
  ok: true
  skipped: string
}

function collectLaunchIssues(input: {
  email: ProductHuntLaunchAutomationResult | ProductHuntLaunchSectionFailure
  social:
    | ProductHuntSectionSkipped
    | ProductHuntSocialAutomationResult
    | ProductHuntLaunchSectionFailure
}): ProductHuntLaunchIssue[] {
  return [
    ...collectEmailIssues(input.email),
    ...collectSocialIssues(input.social),
  ]
}

async function notifyLaunchIssues(input: {
  issues: ProductHuntLaunchIssue[]
  now: Date
}) {
  if (input.issues.length === 0) {
    return
  }

  try {
    await sendProductHuntLaunchIssueAdminNotification({
      dedupeKey: createIssueDedupeKey(input),
      issues: input.issues,
      runAtIso: input.now.toISOString(),
    })
  } catch (error) {
    console.error('[product-hunt-launch] issue notification failed', error)
  }
}

export async function GET(req: NextRequest) {
  await connection()
  const readiness = getProductHuntLaunchReadiness()

  if (areProductHuntLaunchExternalSideEffectsDisabled()) {
    return NextResponse.json({
      ...createProductHuntPreviewExternalSideEffectSkip(),
      readiness,
    })
  }

  const expected = process.env.CRON_SECRET

  if (!expected) {
    return NextResponse.json(
      { error: 'cron secret not set', readiness },
      { status: 500 }
    )
  }

  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (process.env.PRODUCT_HUNT_LAUNCH_AUTOMATION_ENABLED === 'false') {
    return NextResponse.json({
      ok: true,
      readiness,
      skipped: 'product hunt launch automation disabled',
    })
  }

  const result = await withRedisLock(
    'product-hunt-launch:cron',
    14 * 60,
    async () => {
      const now = new Date()
      const productHuntUrlResolution = await resolveProductHuntLaunchUrl({
        candidateUrls: process.env.PRODUCT_HUNT_LAUNCH_URL_CANDIDATES,
        explicitUrl: normalizeProductHuntLaunchUrl(
          process.env.PRODUCT_HUNT_LAUNCH_URL
        ),
        publicUrl: normalizeProductHuntLaunchUrl(
          process.env.NEXT_PUBLIC_PRODUCT_HUNT_LAUNCH_URL
        ),
      })
      const productHuntUrl = productHuntUrlResolution.url

      let email:
        | ProductHuntLaunchAutomationResult
        | ProductHuntLaunchSectionFailure
      try {
        email = await runProductHuntLaunchAutomation({
          batchSize: parseProductHuntBatchSize(
            process.env.PRODUCT_HUNT_LAUNCH_EMAIL_BATCH_SIZE
          ),
          productHuntUrl,
        })
      } catch (error) {
        console.error('[product-hunt-launch] email automation failed', error)
        email = createSectionFailure(error)
      }

      let social:
        | ProductHuntLaunchSectionFailure
        | ProductHuntSocialAutomationResult
        | ProductHuntSectionSkipped
      if (process.env.PRODUCT_HUNT_SOCIAL_AUTOMATION_ENABLED === 'false') {
        social = {
          ok: true as const,
          skipped: 'product hunt social automation disabled',
        }
      } else {
        try {
          social = await runProductHuntSocialAutomation({
            productHuntUrl,
            socialSetId: getNullableEnv('PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID'),
            typefullyUserId: getNullableEnv('PRODUCT_HUNT_TYPEFULLY_USER_ID'),
          })
        } catch (error) {
          console.error('[product-hunt-launch] social automation failed', error)
          social = createSectionFailure(error)
        }
      }

      const issues = collectLaunchIssues({ email, social })
      await notifyLaunchIssues({ issues, now })

      return {
        email,
        issues,
        ok: true,
        productHuntUrl: productHuntUrlResolution,
        readiness,
        social,
      }
    }
  )

  if (!result) {
    return NextResponse.json({
      ok: true,
      readiness,
      skipped: 'product hunt launch automation already running',
    })
  }

  return NextResponse.json(result)
}
