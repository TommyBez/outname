import type { SimpleIcon as SimpleIconData } from 'simple-icons'

export function SimpleIcon({
  icon,
  className,
  title,
}: {
  icon: SimpleIconData
  className?: string
  title?: string
}) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={className}
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <path d={icon.path} fill="currentColor" />
    </svg>
  )
}
