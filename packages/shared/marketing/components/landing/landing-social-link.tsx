import { Button } from '@outname/ui/components/ui/button'
import Link from 'next/link'
import type { ComponentType } from 'react'

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
    <Button
      aria-label={label}
      asChild
      className={className}
      size="icon-lg"
      variant="ghost"
    >
      <Link href={href} rel="noopener noreferrer" target="_blank">
        <Icon color="currentColor" size={iconSize} title="" />
      </Link>
    </Button>
  )
}
