import { withRedisLock } from '@outname/ai/agent-runtime/server/redis-lock'
import {
  normalizeProductHuntLaunchUrl,
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
import {
  type ProductHuntSocialAutomationResult,
  runProductHuntSocialAutomation,
} from '@outname/shared/launch/product-hunt-social-automation'
import { resolveProductHuntLaunchUrl } from '@outname/shared/launch/product-hunt-url-discovery'
import { connection, type NextRequest, NextResponse } from 'next/server'

function getNullableEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

interface ProductHuntLaunchSectionFailure {
  error: string
  ok: false
}

function createSectionFailure(error: unknown): ProductHuntLaunchSectionFailure {
  return {
    error: error instanceof Error ? error.message : 'Unknown error',
    ok: false,
  }
}

export async function GET(req: NextRequest) {
  await connection()

  if (areProductHuntLaunchExternalSideEffectsDisabled()) {
    return NextResponse.json(createProductHuntPreviewExternalSideEffectSkip())
  }

  const expected = process.env.CRON_SECRET

  if (!expected) {
    return NextResponse.json({ error: 'cron secret not set' }, { status: 500 })
  }

  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (process.env.PRODUCT_HUNT_LAUNCH_AUTOMATION_ENABLED === 'false') {
    return NextResponse.json({
      ok: true,
      skipped: 'product hunt launch automation disabled',
    })
  }

  const result = await withRedisLock(
    'product-hunt-launch:cron',
    14 * 60,
    async () => {
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
        | { ok: true; skipped: string }
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

      return {
        email,
        ok: true,
        productHuntUrl: productHuntUrlResolution,
        social,
      }
    }
  )

  if (!result) {
    return NextResponse.json({
      ok: true,
      skipped: 'product hunt launch automation already running',
    })
  }

  return NextResponse.json(result)
}
