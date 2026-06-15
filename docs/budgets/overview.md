# Budgets
Scope: User-wide and per-root-agent USD spend limits for model usage.
Flow:
- Budget preflight calls `checkBudgetExceeded(userId, rootAgentId)` before model/sandbox work.
- Applicable rules are enabled rows for the user where scope is general or `agent_id = rootAgentId`.
- Spend sums from UTC period start, using `actual_cost_usd` when present else `estimated_cost_usd`.
- Usage recording writes provider, model, source, token split, cost source, pricing snapshot, and metadata.
State:
- `budget_rule` stores `daily`, `weekly`, or `monthly` limits with `agent_id = NULL` for general scope.
- `agent_token_usage` stores user, agent, root agent, source, provider, requested/billed model, tokens, and costs.
Anchors:
- `packages/shared/budgets/server/rules.ts`, `spend.ts`, `usage.ts`, `summary.ts`, `periods.ts`
- `packages/shared/budgets/server/actions.ts`, `errors.ts`, `types.ts`
- `packages/db/schema/budgets.ts`
Invariants:
- Limits must be positive USD and are stored to six decimals.
- Agent-scoped spend filters by `root_agent_id`, so sub-agent spend is charged to the root agent.
- One general rule exists per user/period; one agent rule exists per user/agent/period.
- Server actions require a session and assert agent ownership before writing agent-scoped rules.
Failure modes:
- No rules means no block; exceeded spend returns budget info for refusal output.
- Invalid period or non-positive limit throws; zero-token/no-cost observations are skipped.
- Missing pricing records `unknown` cost source and preserves unavailable reasons in metadata.
