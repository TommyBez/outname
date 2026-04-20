"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isActive =
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative py-1 transition-colors",
        isActive
          ? "text-foreground after:absolute after:inset-x-0 after:-bottom-[1px] after:h-px after:bg-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  )
}
