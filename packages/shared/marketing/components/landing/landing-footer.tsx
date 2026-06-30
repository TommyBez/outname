import { SiGithub, SiX } from '@icons-pack/react-simple-icons'
import { getAppLoginUrl } from '@outname/shared/app-url'
import { LandingSocialLink } from '@outname/shared/marketing/components/landing/landing-social-link'
import {
  githubRepositoryUrl,
  xProfileUrl,
} from '@outname/shared/marketing/data/social-links'
import Link from 'next/link'

interface FooterColumn {
  id: string
  links: readonly { external?: boolean; href: string; label: string }[]
  title: string
}

const footerColumns: readonly FooterColumn[] = [
  {
    id: 'product',
    links: [
      { href: '/#anatomy', label: 'How it works' },
      { href: '/#bindings', label: 'Bindings' },
      { href: '/#primitives', label: 'Built on' },
      { href: '/#production', label: 'Production' },
    ],
    title: 'Product',
  },
  {
    id: 'resources',
    links: [
      { href: '/blog', label: 'Blog' },
      { href: '/support', label: 'Support' },
      {
        external: true,
        href: githubRepositoryUrl,
        label: 'GitHub',
      },
    ],
    title: 'Resources',
  },
  {
    id: 'account',
    links: [
      { href: getAppLoginUrl('/agents/new'), label: 'Create an agent' },
      { href: getAppLoginUrl('/dashboard'), label: 'Login' },
    ],
    title: 'Account',
  },
  {
    id: 'legal',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
    ],
    title: 'Legal',
  },
]

export function LandingFooter() {
  return (
    <footer className="border-border border-t px-4 sm:px-6 md:px-10 lg:px-12">
      <div className="mx-auto w-full max-w-7xl py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-4">
            <Link
              className="ease flex w-fit items-center gap-3 font-semibold text-sm tracking-normal transition-colors duration-150 hover:text-brand"
              href="/"
            >
              <span aria-hidden className="size-3 bg-brand" />
              OUTNA.ME
            </Link>
            <p className="max-w-xs text-muted-foreground text-sm leading-relaxed">
              Personal AI agents that remember, learn, and keep working, even
              when you're not there.
            </p>
            <nav
              aria-label="Social"
              className="mt-2 inline-flex w-fit items-stretch border border-border"
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

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {footerColumns.map((column) => (
              <nav aria-label={column.title} key={column.id}>
                <p className="swiss-label text-muted-foreground">
                  {column.title}
                </p>
                <ul className="mt-4 grid gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        className="ease text-muted-foreground text-sm transition-colors duration-150 hover:text-foreground"
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
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-border border-t pt-6 font-mono text-[11px] text-muted-foreground tracking-normal sm:flex-row sm:items-center sm:justify-between">
          <p>© OUTNA.ME · MIT licensed · Open source</p>
          <p>Agents that keep working.</p>
        </div>
      </div>
    </footer>
  )
}
