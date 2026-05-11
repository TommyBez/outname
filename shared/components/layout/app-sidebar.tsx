'use client'

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
import { signOut } from '@/auth/server/auth-client'
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
    <Sidebar className="border-sidebar-border border-r-2" collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b-2 px-3 py-5">
        <Link
          className="flex min-h-11 items-center gap-3 font-black text-foreground text-sm uppercase tracking-[0.22em] transition-colors hover:text-accent"
          href="/dashboard"
        >
          <span
            aria-hidden
            className="inline-block size-3 shrink-0 bg-accent"
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
                    className="font-bold uppercase tracking-[0.12em] data-[active=true]:border-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground"
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

      <SidebarFooter className="border-sidebar-border border-t-2">
        <SidebarMenu>
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
    <Sidebar className="border-sidebar-border border-r-2" collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b-2 px-3 py-5">
        <div className="flex min-h-11 items-center gap-3 font-black text-foreground text-sm uppercase tracking-[0.22em]">
          <span
            aria-hidden
            className="inline-block size-3 shrink-0 bg-accent"
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
  const [isPending, startTransition] = useTransition()

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
      className="font-bold text-muted-foreground uppercase tracking-[0.12em] hover:bg-accent hover:text-foreground"
      disabled={isPending}
      onClick={handleSignOut}
      tooltip="Sign out"
    >
      <LogOut aria-hidden />
      <span>Sign out</span>
    </SidebarMenuButton>
  )
}
