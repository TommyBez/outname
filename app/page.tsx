import { connection } from 'next/server'
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

export default async function HomePage() {
  await connection()
  return <LandingHomePage waitlistEnabled={isWaitlistPublicEnabled()} />
}
