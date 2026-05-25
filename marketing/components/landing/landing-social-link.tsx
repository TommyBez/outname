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
}: {
  href: string
  label: string
  className?: string
  Icon: ComponentType<SocialIconProps>
}) {
  return (
    <Link
      aria-label={label}
      className={cn(
        'ease inline-flex min-h-11 min-w-11 items-center justify-center transition-colors duration-150 hover:bg-foreground hover:text-background',
        className
      )}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <Icon color="currentColor" size={16} title="" />
    </Link>
  )
}
