# AI Elements

Scope: AI streaming and tool UI components in `packages/ai/components/ai-elements`.

Contracts:
- AI Elements compose `@outname/ui` primitives for chat-specific surfaces.
- `PromptInput` can self-manage state or use `PromptInputProvider`.
- Prompt attachments create blob URLs and revoke them on remove, clear, or unmount.
- File constraints call `onError` with `max_files`, `max_file_size`, or `accept`.
- Screenshot capture uses `navigator.mediaDevices.getDisplayMedia` when available.
- `PromptInputSubmit` maps chat status to submit/stop/error affordances.
- `MessageContent` uses wrapping classes so long tokens do not widen the layout.
- Tool parts expose stable state labels for pending, running, approval, completed, denied, error.
- Tool output renders objects/strings as code and returns nothing for empty output.
- `CodeBlock` lazy-loads Shiki and renders raw tokens while highlighting loads.

Failure modes:
- Provider hooks throw when used outside the required provider/context.
- Unknown Shiki languages fall back to plain token rendering.

Anchors: `packages/ai/components/ai-elements/prompt-input.tsx`,
`message.tsx`, `tool.tsx`, `code-block.tsx`, `packages/ai/doctor.config.json`.
