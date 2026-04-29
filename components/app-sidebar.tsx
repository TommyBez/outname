'use client'

import {
  Bot,
  CalendarDays,
  History,
  LogOut,
  Settings as SettingsIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import * as React from 'react'
import { toast } from 'sonner'
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
} from '@/components/ui/sidebar'
import { signOut } from '@/lib/auth-client'

const NAV_ITEMS = [
  { href: '/', label: 'Today', icon: CalendarDays },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/runs', label: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
] as const

interface AppSidebarProps {
  /**
   * Contextual section streamed in from the route layout. Rendered
   * beneath the global nav group so contextual workspaces (e.g. the
   * agent's conversation list) slot into the same sidebar rather than
   * spawning a second one.
   */
  sidebarExtras?: React.ReactNode
}

export function AppSidebar({ sidebarExtras }: AppSidebarProps = {}) {
  const pathname = usePathname()
  const { setOpenMobile, isMobile } = useSidebar()

  const isActive = React.useCallback(
    (href: string) =>
      href === '/'
        ? pathname === '/'
        : pathname === href || pathname.startsWith(href + '/'),
    [pathname]
  )

  // Auto-close the mobile drawer when the route changes.
  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [pathname, isMobile, setOpenMobile])

  return (
    <Sidebar className="border-sidebar-border border-r" collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b px-3 py-4">
        <Link
          className="flex items-center gap-2 font-medium font-mono text-foreground text-sm uppercase tracking-[0.18em] transition-colors hover:text-foreground/80"
          href="/"
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
                    className="data-[active=true]:text-foreground"
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      href={item.href}
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

        {sidebarExtras}
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t">
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
    <Sidebar className="border-sidebar-border border-r" collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b px-3 py-4">
        <div className="flex items-center gap-2 font-medium font-mono text-foreground text-sm uppercase tracking-[0.18em]">
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
                  <SidebarMenuButton asChild tooltip={item.label}>
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
      toast.success('Signed out')
      startTransition(() => {
        router.push('/login')
        router.refresh()
      })
    } catch {
      toast.error('Could not sign out')
    }
  }

  return (
    <SidebarMenuButton
      className="text-muted-foreground hover:text-foreground"
      disabled={isPending}
      onClick={handleSignOut}
      tooltip="Sign out"
    >
      <LogOut aria-hidden />
      <span>Sign out</span>
    </SidebarMenuButton>
  )
}
