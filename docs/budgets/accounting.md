# Budget Accounting
Scope: Spend limits and token usage rows for model work.
Rules:
- A budget rule is user-wide when `agent_id` is null and agent-scoped otherwise.
- Periods are UTC daily, weekly starting Monday, and monthly from day one.
- Enabled applicable rules are the general rules plus rules where `agent_id = rootAgentId`.
- A run is blocked when summed spend is `>= limitUsd`.
Spend:
- Spend sums `COALESCE(actual_cost_usd, estimated_cost_usd, 0)` from the period start.
- Agent-scoped spend filters by `root_agent_id`, so sub-agent invocations charge the root agent.
- Limits are positive USD and stored to six decimal places.
Usage:
- `recordTokenUsageStep` records each generation independently and continues after insert failures.
- Empty usage with no actual cost is skipped.
- Cost source is `actual`, `estimated`, or `unknown`; pricing and unavailable reasons go to metadata.
Preflight:
- Realtime chat persists a text-only refusal and skips sandbox startup, model work, and usage recording.
- Heartbeat/dreaming finalize completed with a budget message when blocked.
Anchors:
- `packages/shared/budgets/server/spend.ts`, `packages/shared/budgets/server/usage.ts`
- `packages/shared/budgets/server/periods.ts`, `packages/shared/budgets/server/rules.ts`
- `packages/ai/agent-runtime/workflows/session/steps/budget.ts`
- Tests: `packages/shared/budgets/server/spend.test.ts`, `packages/shared/budgets/server/usage.test.ts`
- Tests: `packages/shared/budgets/server/summary.test.ts`
- Tests: `packages/ai/agent-runtime/server/realtime-chat-runner.test.ts`
