import { withRedisLock } from '@outname/ai/agent-runtime/server/redis-lock'
import {
  normalizeProductHuntLaunchUrl,
  parseProductHuntBatchSize,
} from '@outname/shared/launch/product-hunt'
import { runProductHuntLaunchAutomation } from '@outname/shared/launch/product-hunt-automation'
import {
  areProductHuntLaunchExternalSideEffectsDisabled,
  createProductHuntPreviewExternalSideEffectSkip,
} from '@outname/shared/launch/product-hunt-preview-safety'
import { runProductHuntSocialAutomation } from '@outname/shared/launch/product-hunt-social-automation'
import { resolveProductHuntLaunchUrl } from '@outname/shared/launch/product-hunt-url-discovery'
import { connection, type NextRequest, NextResponse } from 'next/server'

function getNullableEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
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

      const email = await runProductHuntLaunchAutomation({
        batchSize: parseProductHuntBatchSize(
          process.env.PRODUCT_HUNT_LAUNCH_EMAIL_BATCH_SIZE
        ),
        productHuntUrl,
      })
      const social =
        process.env.PRODUCT_HUNT_SOCIAL_AUTOMATION_ENABLED === 'false'
          ? {
              ok: true as const,
              skipped: 'product hunt social automation disabled',
            }
          : await runProductHuntSocialAutomation({
              productHuntUrl,
              socialSetId: getNullableEnv(
                'PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID'
              ),
              typefullyUserId: getNullableEnv('PRODUCT_HUNT_TYPEFULLY_USER_ID'),
            })

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
