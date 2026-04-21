"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { SignOutButton } from "@/components/sign-out-button"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/agents", label: "Agents" },
  { href: "/runs", label: "History" },
  { href: "/settings", label: "Settings" },
] as const

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  // Close the sheet when the route changes (covers fast client nav that
  // happens before the trigger's default close behavior kicks in).
  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex size-10 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground md:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-4" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-xs"
      >
        <SheetHeader className="border-b border-border px-5 py-5">
          <SheetTitle className="inline-flex items-baseline gap-1.5 font-mono text-sm font-medium uppercase tracking-[0.18em]">
            <span aria-hidden className="text-accent">
              ▪
            </span>
            agents
          </SheetTitle>
          <SheetDescription className="sr-only">
            Main navigation
          </SheetDescription>
        </SheetHeader>

        <nav className="flex flex-col" aria-label="Mobile">
          {LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href ||
                  pathname.startsWith(link.href + "/")
            return (
              <SheetClose asChild key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 border-b border-border px-5 py-4 text-base transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "inline-block size-1.5 rounded-full transition-colors",
                      isActive ? "bg-accent" : "bg-border",
                    )}
                  />
                  <span>{link.label}</span>
                </Link>
              </SheetClose>
            )
          })}
        </nav>

        <div className="mt-auto border-t border-border px-5 py-5">
          <SignOutButton />
        </div>
      </SheetContent>
    </Sheet>
  )
}
