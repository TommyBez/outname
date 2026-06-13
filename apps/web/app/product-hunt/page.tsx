import {
  createProductHuntLaunchState,
  PRODUCT_HUNT_LAUNCH,
} from '@outname/shared/launch/product-hunt'
import { buildProductHuntJsonLd } from '@outname/shared/launch/product-hunt-seo'
import {
  LandingHomePage,
  type LandingSurface,
} from '@outname/shared/marketing/components/landing-home-page'
import { siteConfig } from '@outname/shared/server/site-metadata'
import { isWaitlistPublicEnabled } from '@outname/shared/waitlist/server/public-config'
import { JsonLd } from '@outname/ui/components/seo/json-ld'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'

const surface: LandingSurface = 'product-hunt'

export const metadata: Metadata = {
  title: 'OUTNA.ME for Vercel Day',
  description:
    'Product Hunt Vercel Day launch page for OUTNA.ME, hosted personal AI agents with memory, schedules, tools, channels, and sandboxed execution.',
  alternates: {
    canonical: '/product-hunt',
  },
  openGraph: {
    title: 'OUTNA.ME for Vercel Day',
    description:
      'Hosted personal AI agents built with Vercel Sandbox, Workflow, AI SDK, and Chat SDK.',
    url: '/product-hunt',
    siteName: siteConfig.name,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OUTNA.ME for Vercel Day',
    description:
      'Hosted personal AI agents built with Vercel Sandbox, Workflow, AI SDK, and Chat SDK.',
  },
}

function getProductHuntUrlFromEnv(): string | null {
  return (
    process.env.NEXT_PUBLIC_PRODUCT_HUNT_LAUNCH_URL ??
    process.env.PRODUCT_HUNT_LAUNCH_URL ??
    null
  )
}

function createStaticProductHuntLaunchState() {
  return createProductHuntLaunchState({
    now: new Date(PRODUCT_HUNT_LAUNCH.launchStartIso),
    productHuntUrl: getProductHuntUrlFromEnv(),
  })
}

async function DynamicProductHuntLanding() {
  await connection()

  return (
    <LandingHomePage
      launchState={createProductHuntLaunchState({
        productHuntUrl: getProductHuntUrlFromEnv(),
      })}
      surface={surface}
      waitlistEnabled={isWaitlistPublicEnabled()}
    />
  )
}

export default function ProductHuntPage() {
  return (
    <>
      <JsonLd data={buildProductHuntJsonLd()} />
      <Suspense
        fallback={
          <LandingHomePage
            launchState={createStaticProductHuntLaunchState()}
            surface={surface}
            waitlistEnabled={isWaitlistPublicEnabled()}
          />
        }
      >
        <DynamicProductHuntLanding />
      </Suspense>
    </>
  )
}
