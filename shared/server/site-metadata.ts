import type { Metadata } from 'next'

export const siteConfig = {
  name: 'OUTNA.ME',
  url: 'https://outna.me',
  title: 'OUTNA.ME | Personal AI agents that keep working',
  description:
    'Create personal AI agents with readable memory, schedules, tools, and sandboxed execution.',
  shortDescription: 'Personal AI agents with memory, schedules, and tools.',
  ogImageAlt:
    'OUTNA.ME social preview showing personal AI agents with memory, schedules, tools, and sandboxed execution.',
} as const

export const createPrivatePageMetadata = (
  title: string,
  description: string
): Metadata => ({
  title,
  description,
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
})
