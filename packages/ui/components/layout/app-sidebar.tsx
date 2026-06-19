'use client'

import { signOut } from '@outname/auth/server/auth-client'
import { ThemeToggle } from '@outname/ui/components/theme-toggle'
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
} from '@outname/ui/components/ui/sidebar'
import {
  Bot,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plug,
  Settings as SettingsIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useTransition } from 'react'
import { toast } from 'sonner'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/channels', label: 'Channels', icon: MessageSquare },
  { href: '/connections', label: 'Connections', icon: Plug },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
] as const

interface AppSidebarProps {
  sidebarExtras?: ReactNode
}

export function AppSidebar({ sidebarExtras }: AppSidebarProps = {}) {
  const pathname = usePathname()
  const { setOpenMobile, isMobile } = useSidebar()

  const isActive = useCallback(
    (href: string) =>
      href === '/'
        ? pathname === '/'
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname]
  )

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [isMobile, setOpenMobile])

  return (
    <Sidebar className="border-sidebar-border border-r" collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b px-3 py-5">
        <Link
          className="flex min-h-11 items-center gap-2.5 font-semibold text-foreground text-sm tracking-tight transition-colors hover:text-brand"
          href="/dashboard"
        >
          <span aria-hidden className="inline-block size-3 shrink-0 bg-brand" />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            outna.me
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
          <SidebarMenuItem className="flex items-center justify-between gap-2 px-1 group-data-[collapsible=icon]:justify-center">
            <span className="text-muted-foreground text-xs group-data-[collapsible=icon]:hidden">
              Theme
            </span>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SignOutMenuButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export function AppSidebarFallback() {
  return (
    <Sidebar className="border-sidebar-border border-r" collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b px-3 py-5">
        <div className="flex min-h-11 items-center gap-2.5 font-semibold text-foreground text-sm tracking-tight">
          <span aria-hidden className="inline-block size-3 shrink-0 bg-brand" />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            outna.me
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
  const { push, refresh } = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleSignOut() {
    try {
      await signOut()
      toast.success('Signed out')
      startTransition(() => {
        push('/login')
        refresh()
      })
    } catch {
      toast.error('Could not sign out')
    }
  }

  return (
    <SidebarMenuButton
      className="text-muted-foreground hover:bg-accent hover:text-foreground"
      disabled={isPending}
      onClick={handleSignOut}
      tooltip="Sign out"
    >
      <LogOut aria-hidden />
      <span>Sign out</span>
    </SidebarMenuButton>
  )
}
