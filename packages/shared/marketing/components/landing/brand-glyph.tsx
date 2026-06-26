import {
  SiBetterauth,
  SiCaldotcom,
  SiGithub,
  SiNextdotjs,
  SiOpenrouter,
  SiPostgresql,
  SiPosthog,
  SiResend,
  SiSupabase,
  SiUpstash,
  SiV0,
  SiVercel,
  SiX,
} from '@icons-pack/react-simple-icons'
import {
  Context7Icon,
  FirecrawlIcon,
  ParallelIcon,
  SlackIcon,
  TypefullyIcon,
} from '@outname/shared/marketing/components/landing/brand-icons'
import { cn } from '@outname/ui/lib/utils'
import { MessagesSquareIcon } from 'lucide-react'
import type { ComponentType } from 'react'

type GlyphComponent = ComponentType<{ className?: string }>

// Official monochrome marks. Simple Icons for what it ships (Neon uses the
// Postgres elephant); hand-built faithful marks for the rest. All render in
// currentColor so they stay inside the monochrome + red system.
const ICONS: Record<string, GlyphComponent> = {
  betterauth: SiBetterauth,
  calcom: SiCaldotcom,
  context7: Context7Icon,
  firecrawl: FirecrawlIcon,
  github: SiGithub,
  neon: SiPostgresql,
  nextjs: SiNextdotjs,
  openrouter: SiOpenrouter,
  parallel: ParallelIcon,
  posthog: SiPosthog,
  resend: SiResend,
  slack: SlackIcon,
  supabase: SiSupabase,
  typefully: TypefullyIcon,
  upstash: SiUpstash,
  v0: SiV0,
  vercel: SiVercel,
  x: SiX,
}

// Non-brand surfaces get a Lucide glyph instead of a logo.
const LUCIDE: Record<string, GlyphComponent> = {
  inappchat: MessagesSquareIcon,
}

// Conceptual products with no real mark fall back to a two-letter monogram.
const MONOGRAMS: Record<string, string> = {
  chatsdk: 'Ch',
  llmgateway: 'LM',
}

function brandKey(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('in-app')) {
    return 'inappchat'
  }
  if (lower.includes('vercel')) {
    return 'vercel'
  }
  if (lower.includes('llm')) {
    return 'llmgateway'
  }
  if (lower.includes('openrouter')) {
    return 'openrouter'
  }
  if (lower.includes('next')) {
    return 'nextjs'
  }
  if (lower.includes('neon')) {
    return 'neon'
  }
  if (lower.includes('upstash')) {
    return 'upstash'
  }
  if (lower.includes('better')) {
    return 'betterauth'
  }
  if (lower.includes('chat sdk')) {
    return 'chatsdk'
  }
  return lower.replace(/[^a-z0-9]/g, '')
}

export function BrandGlyph({
  className,
  name,
}: {
  className?: string
  name: string
}) {
  const key = brandKey(name)
  const Icon = ICONS[key] ?? LUCIDE[key]

  if (Icon) {
    return <Icon className={cn('shrink-0', className)} />
  }

  const monogram = MONOGRAMS[key] ?? name.slice(0, 2)
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center font-mono font-semibold text-[8px] leading-none',
        className
      )}
    >
      {monogram}
    </span>
  )
}
