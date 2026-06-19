import { SiGithub, SiX } from '@icons-pack/react-simple-icons'
import { LandingSocialLink } from '@outname/shared/marketing/components/landing/landing-social-link'
import {
  githubRepositoryUrl,
  xProfileUrl,
} from '@outname/shared/marketing/data/social-links'
import Link from 'next/link'

export function LandingFooter() {
  return (
    <footer className="border-border border-t px-4 sm:px-6 md:px-10 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 py-8 sm:flex-row">
        <Link
          className="ease font-semibold text-sm tracking-normal transition-colors duration-150 hover:text-brand"
          href="/"
        >
          OUTNA.ME
        </Link>
        <nav
          aria-label="Social"
          className="inline-flex items-stretch border border-border"
        >
          <LandingSocialLink
            href={githubRepositoryUrl}
            Icon={SiGithub}
            iconSize={20}
            label="GitHub repository"
          />
          <LandingSocialLink
            className="border-border border-l"
            href={xProfileUrl}
            Icon={SiX}
            iconSize={17}
            label="X profile"
          />
        </nav>
      </div>
    </footer>
  )
}
