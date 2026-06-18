# UI System

Scope/boundary: UI system covers shared product primitives in `@outname/ui`
and AI-specific streaming/composition components in `packages/ai/components/ai-elements`.

Flow/state:
- Apps include Tailwind sources for local app code plus shared UI packages.
- Global tokens define a light, high-contrast Swiss system with black/white/red signals.
- Base primitives use `cn`, CVA variants, Radix/shadcn structure, and `data-slot` hooks.
- Layout owns `AppShell`, sidebar state, command palette, skip link, and timezone bootstrap.
- AI elements compose primitives for conversations, messages, prompts, tools, code, and files.

Invariants:
- Use `@outname/ui` for reusable controls; keep AI stream/tool surfaces in AI elements.
- `cn()` is the class merge boundary for extending primitive styles.
- Sidebar state is client/cookie persisted; `AppShell` stays static-friendly via Suspense.
- Chat/message surfaces must wrap long tokens instead of clipping or widening layout.

Failure modes:
- Provider hooks throw when prompt-input or message-branch components are mis-nested.
- Code blocks show raw/plain tokens while Shiki or a language grammar loads.
- Tool output renders JSON/code for objects and strings; empty output renders nothing.

Anchors: `packages/ui/components/ui/*`, `packages/ui/components/layout/*`,
`packages/ui/lib/utils.ts`,
`packages/ai/components/ai-elements/message.tsx`,
`packages/ai/components/ai-elements/prompt-input.tsx`,
`packages/ai/components/ai-elements/tool.tsx`,
`packages/ai/components/ai-elements/code-block.tsx`.
