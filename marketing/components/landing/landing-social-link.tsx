import Link from 'next/link'
import type { SimpleIcon as SimpleIconData } from 'simple-icons'
import { cn } from '@/lib/utils'
import { SimpleIcon } from '@/marketing/components/landing/simple-icon'

export function LandingSocialLink({
  href,
  icon,
  label,
  className,
}: {
  href: string
  icon: SimpleIconData
  label: string
  className?: string
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
      <SimpleIcon className="size-4" icon={icon} />
    </Link>
  )
}
