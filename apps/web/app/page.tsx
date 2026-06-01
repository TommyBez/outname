import { LandingHomePage } from '@outname/shared/marketing/components/landing-home-page'
import { siteConfig } from '@outname/shared/server/site-metadata'
import { isWaitlistPublicEnabled } from '@outname/shared/waitlist/server/public-config'

export const metadata = {
  title: {
    absolute: siteConfig.title,
  },
  alternates: {
    canonical: '/',
  },
}

export default function HomePage() {
  return <LandingHomePage waitlistEnabled={isWaitlistPublicEnabled()} />
}
