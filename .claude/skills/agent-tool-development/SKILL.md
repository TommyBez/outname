---
name: agent-tool-development
description: Develop maintainer-shipped tools for agents in this application. Use when adding or changing agent tools, connectors, tool sandboxes, sub-agent tool behavior, or credential handling for tools.
---

This skill guides development of safe, maintainable agent tools in this Next.js application.

Use it when the user asks to add, modify, review, or debug a tool that an agent can call. In this app, "tools" means AI SDK tools produced from TypeScript `MaintainerTool` definitions, built-in memory and exec tools, or sub-agent tools. It does not mean markdown skills loaded into the runtime.

## First Map the Tool Shape

Before coding, identify which tool shape the request needs:

- **Maintainer catalog tool**: platform-owned TypeScript in `tools/<name>.ts`, registered in `tools/registry.ts`.
- **Connector**: credential form, validation, and provider-specific credential decoding in `connectors/<provider>.ts`, registered in `connectors/registry.ts`.
- **Tool sandbox**: isolated Vercel Sandbox runtime for heavy dependencies, declared under `tools/sandboxes/<manifest>/`.
- **Sub-agent tool**: another agent attached as an `agent_<id>` tool through `tools/agent-tool.ts`.
- **Built-in memory or exec tool**: core session tools under `workflows/agent-session/tools/`; change these only when the platform-level agent contract itself changes.

Follow the existing path unless there is a strong reason not to. A new API integration is usually a maintainer tool plus connector. A browser, ffmpeg, Python, or other heavyweight runtime is usually a maintainer tool plus tool sandbox.

## Keep the Three Data Layers Separate

Every maintainer tool has three data layers. Do not collapse them.

1. **Credential layer**: secret bytes and provider-required auth adjuncts. These live behind a connector, are stored encrypted in `user_connections.credentials`, and arrive at build time as `ToolBuildContext.credentials[provider]`.
2. **Attachment config layer**: per-agent, non-secret defaults such as sender address, calendar id, account id, or preferred channel. These live in `agent_tools.config`, are validated by `tool.configSchema`, and may be represented by `configFields`.
3. **Per-call input layer**: the model's immediate arguments for one invocation. These live only in the AI SDK tool `inputSchema`.

Decision rule:

- Secret or token -> connector form.
- "Which account/channel/default should this attachment use?" -> `configSchema`.
- "What should the agent do right now?" -> `inputSchema`.

If a value could let compromised sandboxed code authenticate directly, treat it as a credential even if it is not named `apiKey`.

## Implementation Checklist

For a new maintainer tool:

1. Create `tools/<tool>.ts`.
2. Export a `MaintainerTool` with a stable `id`, category, display name, description, requirements, optional `configSchema`, and `build(ctx)`.
3. Keep `build(ctx)` synchronous and side-effect-light. It should parse config and return an AI SDK `tool()`.
4. Put async provider calls, sandbox calls, and workflow-sensitive work inside helper functions marked with `'use step'` when they run during a tool invocation.
5. Register the tool in `tools/registry.ts`.
6. If it needs credentials, add or reuse a connector in `connectors/registry.ts` and make the tool requirement provider string match the connector provider exactly.
7. If it needs a sandbox, add a manifest and setup script under `tools/sandboxes/`, register the manifest in `tools/sandboxes/index.ts`, and declare `{ kind: 'tool_sandbox', manifest: '<id>' }`.
8. Verify attach flow behavior in `lib/tool-actions.ts`: config validation, pending sandbox build state, reconnect reasons, and UI cache invalidation should already work through the registry contract.

Prefer narrow tools with explicit Zod schemas. Return structured results that include enough context for the agent to recover from provider errors without exposing secrets.

## Credential Safety Rules

Tool code must preserve the credential boundary:

- Do not query `user_connections` from a tool.
- Do not import encryption, DB credential rows, or connector runtime code into `tools/build-attached-tools.ts` or workflow bodies that must stay free of `node:crypto`.
- Do not add `userId` or broad database access to `ToolBuildContext`.
- Do not place secrets in `agent_tools.config`, tool input schemas, system prompts, logs, stdout, stderr, sandbox env vars, command arguments, or files.
- Do not ask the model for credentials. Use connector reconnect UI instead.
- Keep reconnect variants small because each new variant affects the system prompt, catalog UI, and settings flow.

When a tool needs an external API key, the safe default is:

1. Connector validates and stores the credential.
2. `resolveToolPlan()` decrypts credentials inside a workflow step and returns only a plain JSON-safe credential map.
3. `buildAttachedTools()` passes only the required credential slice to `tool.build(ctx)`.
4. The tool converts the opaque credential with a provider helper such as `resendApiKey(credentials.resend)`.

## Sandbox and Header Credential Brokering

Use tool sandboxes for code that needs heavy native dependencies, browser state, or an isolated execution environment. A tool sandbox is not a place to hand secrets to untrusted code.

Vercel Sandbox supports network policy header injection with `transform`, where the firewall adds or replaces HTTP headers on matching outbound HTTPS requests. Use that pattern when sandboxed code must call authenticated services. Source: https://vercel.com/changelog/safely-inject-credentials-in-http-headers-with-vercel-sandbox

- Configure credentials outside the sandbox VM boundary.
- Inject auth headers through `Sandbox.create({ networkPolicy: { allow: { '<domain>': [{ transform: [{ headers: { Authorization: 'Bearer ...' } }] }] } } })`.
- Match only the required domains, using wildcards only when they are genuinely required.
- Rely on header replacement so sandbox code cannot substitute its own value for the same header.
- For multi-phase work, update the network policy to inject credentials only during the setup phase, then remove them or switch to `deny-all` before running untrusted code.

Never pass provider tokens into a sandbox through environment variables, command arguments, stdin, files, or model-visible tool input. If the installed `@vercel/sandbox` API does not yet expose the header injection shape needed for a tool, stop and add a platform-level abstraction rather than leaking secrets into the VM.

For current tool sandboxes:

- Start from snapshot manifests registered in `tools/sandboxes/index.ts`.
- Use `getOrStartToolSandbox(manifestId)` from inside a `'use step'` helper.
- Keep stdout and stderr bounded before returning them to the model.
- Treat sandbox cache reuse as an optimization. Correctness must survive a fresh sandbox per call or per event.
- Let attach-time sandbox builds and reconnects handle missing snapshots instead of crashing the agent session.

## Runtime Boundaries to Respect

The session boot path is intentionally split:

- `resolveToolPlan()` does DB reads, config parsing, credential resolution, sub-agent checks, and sandbox readiness checks inside a workflow step.
- `buildAttachedTools()` is pure synchronous TypeScript with no DB, crypto, or connector runtime imports.
- `agent-factory.ts` merges memory tools, exec tools, and attached tools into the `DurableAgent`.

Preserve this split. If a change requires new async state at boot, add it to the plan step and pass a JSON-safe result across the boundary. If a change requires runtime work during a tool call, put it behind a `'use step'` helper called from the AI SDK tool `execute`.

## Error Handling and Observability

Design failures so the agent and user can recover:

- Invalid attachment config -> `config_invalid` reconnect.
- Missing or invalid credential -> connector reconnect.
- Removed registry entry -> `tool_removed`.
- Tool build exception -> `build_failed`.
- Sandbox build in progress or unavailable -> sandbox reconnect variants.
- Provider call failure -> structured tool result with HTTP status and a short sanitized message.

Do not throw provider response bodies directly if they may contain secrets. Truncate noisy output, avoid console logs for expected provider failures, and never log raw credentials.

## Review Checklist

Before finishing tool work, verify:

- The tool id is stable and unique.
- Requirements match actual runtime needs.
- Credential, config, and input layers are separated.
- Zod schemas reject malformed user and model input.
- The connector owns credential validation and decoding.
- No secret crosses into prompts, logs, sandbox-visible state, or model-controlled arguments.
- Tool sandbox manifests have deterministic setup scripts and stable hashes.
- Reconnect behavior is understandable to both the UI and the system prompt.
- Local validation covers the changed path. Run `pnpm check`, and manually test through the UI when tool attachment or invocation behavior changes.
