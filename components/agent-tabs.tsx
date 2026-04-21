"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface AgentTab {
  key: string
  label: string
  href: string
  /**
   * When true, the tab lights up on any pathname that starts with `href + "/"`
   * (e.g. nested child routes). The "home" tab for an agent should leave this
   * false so it doesn't steal the highlight from child tabs.
   */
  matchNested?: boolean
  disabled?: boolean
  disabledReason?: string
}

interface AgentTabsProps {
  tabs: AgentTab[]
}

/**
 * Minimal underline tab strip for the agent detail routes. Renders
 * anchors (so Next.js prefetches) with an active state derived from the
 * current pathname, and falls back to a visually-disabled span when the
 * agent's kind does not expose that tab.
 */
export function AgentTabs({ tabs }: AgentTabsProps) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Agent sections"
      className="mb-10 flex flex-wrap items-center gap-6 border-b border-border"
    >
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href ||
          (tab.matchNested === true &&
            pathname.startsWith(`${tab.href}/`))

        if (tab.disabled) {
          return (
            <span
              key={tab.key}
              aria-disabled="true"
              title={tab.disabledReason}
              className="-mb-px inline-flex cursor-not-allowed items-center gap-2 border-b-2 border-transparent pb-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/50"
            >
              {tab.label}
            </span>
          )
        }

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 pb-2 font-mono text-xs uppercase tracking-[0.2em] transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
