import { SiGithub } from '@icons-pack/react-simple-icons'
import { NavLink } from '@outname/shared/marketing/components/landing/landing-links'
import { LandingSocialLink } from '@outname/shared/marketing/components/landing/landing-social-link'
import { githubRepositoryUrl } from '@outname/shared/marketing/data/social-links'
import Link from 'next/link'

export function LandingNav({ waitlistEnabled }: { waitlistEnabled: boolean }) {
  return (
    <header className="absolute top-0 right-0 left-0 z-10 px-4 pt-5 sm:px-6 md:px-10 lg:px-12">
      <nav
        aria-label="Home"
        className="mx-auto flex w-full min-w-0 max-w-7xl items-center justify-between gap-4 border-2 border-foreground bg-background p-2"
      >
        <Link
          className="ease flex min-h-11 min-w-0 items-center gap-3 px-3 font-black text-sm uppercase tracking-normal transition-colors duration-150 hover:text-accent"
          href="/"
        >
          <span aria-hidden className="size-3 bg-accent" />
          OUTNA.ME
        </Link>
        <div className="flex items-center gap-1">
          <div className="hidden items-center gap-1 sm:flex">
            <NavLink href="/blog">Blog</NavLink>
            {waitlistEnabled ? (
              <NavLink href="/waitlist?source=landing-nav">Waitlist</NavLink>
            ) : null}
            <NavLink href="/login?from=/dashboard">Login</NavLink>
          </div>
          <LandingSocialLink
            className="border-foreground sm:border-l-2"
            href={githubRepositoryUrl}
            Icon={SiGithub}
            iconSize={20}
            label="GitHub repository"
          />
        </div>
      </nav>
    </header>
  )
}
