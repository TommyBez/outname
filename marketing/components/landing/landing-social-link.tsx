import Link from 'next/link'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

interface SocialIconProps {
  className?: string
  color?: string
  size?: number | string
  title?: string
}

export function LandingSocialLink({
  href,
  label,
  className,
  Icon,
  iconSize = 18,
}: {
  href: string
  label: string
  className?: string
  Icon: ComponentType<SocialIconProps>
  /** Pixel size tuned per mark so icons look equal inside the square cell. */
  iconSize?: number
}) {
  return (
    <Link
      aria-label={label}
      className={cn(
        'ease inline-flex size-11 shrink-0 items-center justify-center transition-colors duration-150 hover:bg-foreground hover:text-background',
        className
      )}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <Icon color="currentColor" size={iconSize} title="" />
    </Link>
  )
}
