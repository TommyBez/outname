# Transcript And Activity Streams

Scope: durable event stream APIs and transcript persistence.

- Output namespace is `reply:<eventId>` except invocation, which uses payload `streamToken`.
- Activity namespace is `events:<workflowRunId>` from `runEventsNamespace`.
- `GET .../stream?stream=output|activity&startIndex=N` reads from the selected namespace.
- `startIndex` is floored and clamped to `>=0`; invalid input replays from `0`.
- Route emits newline-delimited JSON and sets `no-store, no-transform`.
- Missing readable workflow id returns 409 `event has not started yet`.
- Missing workflow run triggers active-event reconciliation, then returns 503 unavailable.
- Live hook opens output and activity streams, tracking separate replay indexes.
- 409 is pending and retries after 1500ms; 503 is unavailable and triggers fallback handling.
- Generic stream failures retry up to 5 attempts with 1s, 2s, 4s, then 8s backoff.
- Terminal events with a workflow run require persisted transcript rows; missing rows return transcript 409.
- Non-terminal/no-run events use fallback messages such as queued, starting, or failed status text.

Source: `apps/api/app/api/agents/[agentId]/events/[eventId]/stream/route.ts`; `.../transcript/route.ts`; `server/agent-event-transcript.ts`; `hooks/use-agent-event-live-transcript.ts`.
Tests: `apps/api/app/api/agents/[agentId]/events/[eventId]/stream/route.test.ts`; `.../transcript/route.test.ts`; `server/agent-event-transcript.test.ts`; `hooks/agent-event-stream-outcome.test.ts`.
