# Components

Scope: reusable product primitives in `@outname/ui`.

Contracts:
- `@outname/ui` exports source files directly through `./*`.
- `cn()` is the merge boundary for `clsx` plus `tailwind-merge`.
- Button variants use CVA and preserve `data-slot`, `data-variant`, and `data-size`.
- Button icon sizes are stable through size variants and SVG child rules.
- Radix/shadcn primitives provide structure for dialogs, menus, tabs, forms, and sidebar.
- Layout components own shell, sidebar, timezone bootstrap, and command palette.
- SEO/social helpers live in UI when reused across app and web surfaces.

Invariants:
- Shared controls belong in `packages/ui/components/ui`.
- App-specific composition belongs in app/shared packages, not primitive files.
- Keep icons from `lucide-react` where possible.
- Extend primitives with `className`; avoid duplicating variant systems.

Failure modes:
- Missing `cn()` merging can leave conflicting Tailwind classes active.
- React Doctor ignores generated-style primitive folders; still typecheck them.

Anchors: `packages/ui/components/ui/*`, `packages/ui/lib/utils.ts`,
`packages/ui/package.json`, `packages/ui/doctor.config.json`.
