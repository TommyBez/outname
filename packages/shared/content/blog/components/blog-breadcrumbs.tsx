import Link from 'next/link'

interface BlogBreadcrumbItem {
  href?: string
  label: string
}

interface BlogBreadcrumbsProps {
  items: BlogBreadcrumbItem[]
}

export function BlogBreadcrumbs({ items }: BlogBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li className="inline-flex items-center gap-2" key={item.label}>
              {item.href && !isLast ? (
                <Link
                  className="transition-colors hover:text-brand"
                  href={item.href}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
              {isLast ? null : <span aria-hidden>/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
