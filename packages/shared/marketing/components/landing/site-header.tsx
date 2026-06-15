'use client'

import { SiGithub } from '@icons-pack/react-simple-icons'
import { getAppLoginUrl } from '@outname/shared/app-url'
import { LandingSocialLink } from '@outname/shared/marketing/components/landing/landing-social-link'
import { NavLink } from '@outname/shared/marketing/components/landing/nav-link'
import { githubRepositoryUrl } from '@outname/shared/marketing/data/social-links'
import Link from 'next/link'

const SECTION_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#continuity', label: 'Continuity' },
  { href: '#compose', label: 'Tools' },
  { href: '#open-source', label: 'Open source' },
] as const

export function SiteHeader({ waitlistEnabled }: { waitlistEnabled: boolean }) {
  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6 md:px-10 lg:px-12">
      <nav
        aria-label="Primary"
        className="mx-auto flex w-full min-w-0 max-w-7xl items-center justify-between gap-4 border-2 border-foreground bg-background/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <Link
          className="ease flex min-h-11 min-w-0 items-center gap-3 px-3 font-black text-sm uppercase tracking-normal transition-colors duration-150 hover:text-accent"
          href="/"
        >
          <span aria-hidden className="size-3 bg-accent" />
          OUTNA.ME
        </Link>

        <div className="hidden items-center lg:flex">
          {SECTION_LINKS.map((link) => (
            <NavLink href={link.href} key={link.href}>
              {link.label}
            </NavLink>
          ))}
          <NavLink href="/blog">Blog</NavLink>
        </div>

        <div className="flex items-center gap-1">
          <div className="hidden items-center sm:flex">
            <NavLink href={getAppLoginUrl('/dashboard')}>Sign in</NavLink>
          </div>
          <LandingSocialLink
            className="border-foreground sm:border-l-2"
            href={githubRepositoryUrl}
            Icon={SiGithub}
            iconSize={20}
            label="GitHub repository"
          />
          {waitlistEnabled ? (
            <Link
              className="ease ml-1 hidden min-h-11 items-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.12em] transition-colors duration-150 hover:border-accent hover:bg-accent hover:text-foreground sm:inline-flex"
              href="/waitlist?source=landing-nav"
            >
              Join waitlist
            </Link>
          ) : null}
        </div>
      </nav>
    </header>
  )
}
