/**
 * Wire format used in the AI-SDK tool key for a sub-agent. The model
 * never sees the raw child id — it sees the prefixed slug, which we
 * unprefix in `resolveToolPlan` and `attachToolAction` only.
 *
 * Lives in its own zero-dependency module so client components (the
 * sub-agent catalog) can import the constant without dragging the
 * full sub-agent tool runtime — and its `workflow` dependency, which
 * uses `node:async_hooks` — into the browser bundle.
 */
export const AGENT_TOOL_PREFIX = 'agent_'
