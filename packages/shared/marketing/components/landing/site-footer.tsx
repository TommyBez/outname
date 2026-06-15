'use client'

import { SiGithub, SiX } from '@icons-pack/react-simple-icons'
import { getAppLoginUrl } from '@outname/shared/app-url'
import { LandingSocialLink } from '@outname/shared/marketing/components/landing/landing-social-link'
import { SwissLabel } from '@outname/shared/marketing/components/landing/section-kit'
import {
  githubRepositoryUrl,
  xProfileUrl,
} from '@outname/shared/marketing/data/social-links'
import Link from 'next/link'

interface FooterLink {
  external?: boolean
  href: string
  label: string
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: FooterLink[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <SwissLabel className="text-muted-foreground">{title}</SwissLabel>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              className="ease font-medium text-foreground text-sm transition-colors duration-150 hover:text-accent"
              href={link.href}
              {...(link.external
                ? { rel: 'noopener noreferrer', target: '_blank' }
                : {})}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SiteFooter({ waitlistEnabled }: { waitlistEnabled: boolean }) {
  const product: FooterLink[] = [
    { href: '#how', label: 'How it works' },
    { href: '#continuity', label: 'Continuity' },
    { href: '#compose', label: 'Tools' },
    { href: '#open-source', label: 'Open source' },
    { href: '/blog', label: 'Blog' },
  ]
  const access: FooterLink[] = [
    ...(waitlistEnabled
      ? [
          {
            href: '/waitlist?source=landing-footer',
            label: 'Join the waitlist',
          },
        ]
      : []),
    { href: getAppLoginUrl('/dashboard'), label: 'Sign in' },
  ]
  const legal: FooterLink[] = [
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
    { href: '/support', label: 'Support' },
  ]

  return (
    <footer className="border-foreground border-t-4 px-4 sm:px-6 md:px-10 lg:px-12">
      <div className="mx-auto w-full max-w-7xl py-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
          <div className="flex max-w-sm flex-col gap-4">
            <Link
              className="ease flex items-center gap-3 font-black text-lg uppercase tracking-normal transition-colors duration-150 hover:text-accent"
              href="/"
            >
              <span aria-hidden className="size-3 bg-accent" />
              OUTNA.ME
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Hosted personal AI agents with readable memory, schedules, tools,
              and sandboxed execution. Open source (MIT).
            </p>
            <nav
              aria-label="Social"
              className="mt-2 inline-flex w-fit items-stretch border-2 border-foreground"
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

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:gap-16">
            <FooterColumn links={product} title="Product" />
            <FooterColumn links={access} title="Access" />
            <FooterColumn links={legal} title="Legal" />
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-foreground border-t-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-muted-foreground text-xs">
            © OUTNA.ME — Open source (MIT)
          </p>
          <p className="font-mono text-muted-foreground text-xs">
            Agents that keep working.
          </p>
        </div>
      </div>
    </footer>
  )
}
