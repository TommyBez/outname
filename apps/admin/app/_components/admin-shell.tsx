'use client'

import { signOut } from '@outname/auth/server/auth-client'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@outname/ui/components/ui/sidebar'
import { ClipboardList, LayoutDashboard, LogOut, Shield } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useTransition } from 'react'
import { toast } from 'sonner'

const ADMIN_NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/waitlist', label: 'Waitlist', icon: ClipboardList },
] as const

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:border-2 focus:border-foreground focus:bg-accent focus:px-4 focus:py-3 focus:font-bold focus:text-foreground focus:text-xs focus:uppercase focus:tracking-[0.18em]"
        href="#main-content"
      >
        Skip to content
      </a>
      <AdminSidebar />
      <SidebarInset className="swiss-grid-pattern min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-foreground border-b-2 bg-background px-3 lg:h-12 lg:px-4">
          <SidebarTrigger className="-ml-1 size-10 border-foreground lg:size-9" />
          <Link
            className="inline-flex min-h-11 items-center gap-2 font-bold text-sm uppercase tracking-[0.2em] transition-colors hover:text-accent lg:hidden"
            href="/"
          >
            <Shield aria-hidden className="size-4" />
            <span>Admin</span>
          </Link>
        </header>
        <main
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10 md:px-8 md:py-12 lg:px-12 lg:py-16"
          id="main-content"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AdminSidebar() {
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
          href="/"
        >
          <Shield aria-hidden className="size-4 shrink-0 text-accent" />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            outna.me admin
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {ADMIN_NAV_ITEMS.map((item) => (
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
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <AdminSignOutButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function AdminSignOutButton() {
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
