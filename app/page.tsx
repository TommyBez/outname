import { LandingHomePage } from '@/components/landing-home-page'
import { siteConfig } from '@/lib/site-metadata'

export const metadata = {
  title: {
    absolute: siteConfig.title,
  },
  alternates: {
    canonical: '/',
  },
}

export default function HomePage() {
  return <LandingHomePage />
}
