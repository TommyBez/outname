import { LandingHomePage } from '@/marketing/components/landing-home-page'
import { siteConfig } from '@/shared/server/site-metadata'
import { isWaitlistPublicEnabled } from '@/waitlist/server/public-config'

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
