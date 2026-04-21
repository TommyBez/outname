"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  Bot,
  History,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { signOut } from "@/lib/auth-client"

const NAV_ITEMS = [
  { href: "/", label: "Today", icon: CalendarDays },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/runs", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const { setOpenMobile, isMobile } = useSidebar()

  const isActive = React.useCallback(
    (href: string) =>
      href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(href + "/"),
    [pathname],
  )

  // Auto-close the mobile drawer when the route changes.
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [pathname, isMobile, setOpenMobile])

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-mono text-sm font-medium uppercase tracking-[0.18em] text-foreground transition-colors hover:text-foreground/80"
        >
          <span
            aria-hidden
            className="inline-block size-2 shrink-0 bg-accent"
          />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            agents
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    className="data-[active=true]:text-foreground"
                  >
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? "page" : undefined}
                    >
                      <item.icon aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SignOutMenuButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

/**
 * Static, non-active version of the sidebar used as a Suspense fallback.
 * Identical visual structure so the swap-in is invisible — the only
 * difference is that no item is marked active, which is fine because the
 * real sidebar streams in immediately after hydration.
 */
export function AppSidebarFallback() {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2 font-mono text-sm font-medium uppercase tracking-[0.18em] text-foreground">
          <span
            aria-hidden
            className="inline-block size-2 shrink-0 bg-accent"
          />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            agents
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton tooltip={item.label} asChild>
                    <Link href={item.href}>
                      <item.icon aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

function SignOutMenuButton() {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()

  async function handleSignOut() {
    try {
      await signOut()
      toast.success("Signed out")
      startTransition(() => {
        router.push("/login")
        router.refresh()
      })
    } catch {
      toast.error("Could not sign out")
    }
  }

  return (
    <SidebarMenuButton
      onClick={handleSignOut}
      disabled={isPending}
      tooltip="Sign out"
      className="text-muted-foreground hover:text-foreground"
    >
      <LogOut aria-hidden />
      <span>Sign out</span>
    </SidebarMenuButton>
  )
}
