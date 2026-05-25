import { SiGithub, SiX } from '@icons-pack/react-simple-icons'
import Link from 'next/link'
import { LandingSocialLink } from '@/marketing/components/landing/landing-social-link'
import { githubRepositoryUrl, xProfileUrl } from '@/marketing/data/social-links'

export function LandingFooter() {
  return (
    <footer className="border-foreground border-t-2 px-4 sm:px-6 md:px-10 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 py-8 sm:flex-row">
        <Link
          className="ease font-black text-sm uppercase tracking-normal transition-colors duration-150 hover:text-accent"
          href="/"
        >
          OUTNA.ME
        </Link>
        <nav
          aria-label="Social"
          className="inline-flex items-stretch border-2 border-foreground"
        >
          <LandingSocialLink
            href={githubRepositoryUrl}
            Icon={SiGithub}
            iconSize={20}
            label="GitHub repository"
          />
          <LandingSocialLink
            className="border-foreground border-l-2"
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
