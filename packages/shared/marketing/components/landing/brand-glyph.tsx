import {
  SiBetterauth,
  SiCaldotcom,
  SiGithub,
  SiNextdotjs,
  SiOpenrouter,
  SiPosthog,
  SiResend,
  SiSupabase,
  SiUpstash,
  SiV0,
  SiVercel,
  SiX,
} from '@icons-pack/react-simple-icons'
import { cn } from '@outname/ui/lib/utils'
import { MessagesSquareIcon } from 'lucide-react'
import type { ComponentType } from 'react'

type GlyphComponent = ComponentType<{ className?: string }>

// Official monochrome marks (Simple Icons). Rendered in currentColor so they
// stay inside the monochrome + red system — never the brand's own color.
const ICONS: Record<string, GlyphComponent> = {
  betterauth: SiBetterauth,
  calcom: SiCaldotcom,
  github: SiGithub,
  nextjs: SiNextdotjs,
  openrouter: SiOpenrouter,
  posthog: SiPosthog,
  resend: SiResend,
  supabase: SiSupabase,
  upstash: SiUpstash,
  v0: SiV0,
  vercel: SiVercel,
  x: SiX,
}

// Non-brand surfaces get a Lucide glyph instead of a logo.
const LUCIDE: Record<string, GlyphComponent> = {
  inappchat: MessagesSquareIcon,
}

// Brands Simple Icons doesn't ship (pulled for trademark, or too niche) fall
// back to a clean two-letter monogram in the same square.
const MONOGRAMS: Record<string, string> = {
  chatsdk: 'Ch',
  context7: 'C7',
  firecrawl: 'Fc',
  llmgateway: 'LM',
  neon: 'Ne',
  parallel: 'Pl',
  slack: 'Sl',
  typefully: 'Tf',
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
