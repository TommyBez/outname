import { buildProductHuntJsonLd } from '@outname/shared/launch/product-hunt-seo'
import { LandingHomePage } from '@outname/shared/marketing/components/landing-home-page'
import { siteConfig } from '@outname/shared/server/site-metadata'
import { isWaitlistPublicEnabled } from '@outname/shared/waitlist/server/public-config'
import { JsonLd } from '@outname/ui/components/seo/json-ld'
import { connection } from 'next/server'
import { Suspense } from 'react'
import {
  createDynamicProductHuntLaunchState,
  createStaticProductHuntLaunchState,
} from './product-hunt-launch-state'

export const metadata = {
  title: {
    absolute: siteConfig.title,
  },
  alternates: {
    canonical: '/',
  },
}

async function DynamicHomeLanding() {
  await connection()

  return (
    <LandingHomePage
      launchState={await createDynamicProductHuntLaunchState()}
      waitlistEnabled={isWaitlistPublicEnabled()}
    />
  )
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={buildProductHuntJsonLd()} />
      <Suspense
        fallback={
          <LandingHomePage
            launchState={createStaticProductHuntLaunchState()}
            waitlistEnabled={isWaitlistPublicEnabled()}
          />
        }
      >
        <DynamicHomeLanding />
      </Suspense>
    </>
  )
}
