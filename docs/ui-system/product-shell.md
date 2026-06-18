# Product Shell

Scope: authenticated app chrome and global UI contracts.

Shell contract:
- `AppShell` wraps product pages in `SidebarProvider`, `AppSidebar`, header, and main.
- Shell keeps server rendering static-friendly and restores sidebar state on the client.
- Sidebar and timezone bootstrap are loaded through `Suspense`.
- Main content has `id="main-content"` and a skip link targets it.
- Header contains sidebar trigger, mobile brand link, and command palette trigger.
- Sidebar nav owns dashboard, agents, channels, connections, and settings links.
- Sign-out calls Better Auth client sign-out, then pushes and refreshes `/login`.

Token contract:
- App globals include Tailwind sources for local app, UI, shared, and AI packages.
- Web globals include local web, UI, and shared sources.
- Tokens are light-first, high-contrast black/white/red with zero radius.
- Swiss red is the signal color for accent, destructive, and focus ring.

Failure modes:
- Sidebar client state may differ before hydration; shell defaults open on server.
- Product shell changes require manual browser verification.

Anchors: `packages/ui/components/layout/app-shell.tsx`,
`packages/ui/components/layout/app-sidebar.tsx`, `apps/app/app/globals.css`,
`apps/web/app/globals.css`.
