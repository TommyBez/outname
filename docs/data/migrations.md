# Migrations
Scope: Drizzle schema history for the remote Neon Postgres database.
Rules:
- Schema source is `packages/db/schema/index.ts`; generated SQL lives in `packages/db/drizzle/`.
- `packages/db/drizzle.config.ts` requires `DATABASE_URL` and normalizes it for `pg`.
- Runtime `packages/db/index.ts` uses a `pg` pool with `attachDatabasePool`.
- Use the pooled Neon host containing `-pooler`; no local Postgres is expected.
Workflow:
- `pnpm --filter @outname/db db:generate` writes SQL plus `drizzle/meta/_journal.json`.
- `pnpm --filter @outname/db db:migrate` applies committed migrations.
- `drizzle-kit push` is for direct sync and needs `--force` or an interactive TTY.
Migration anchors:
- `packages/db/drizzle/0011_connector_connections.sql` maps legacy providers to `connector_id`.
- `packages/db/drizzle/0013_channel_scope_thread_ids.sql` standardizes external ids.
- `packages/db/drizzle/0016_inference_providers.sql` moves `user.ai_gateway_api_key`.
- `packages/db/drizzle/0019_auth_user_id_snake_case.sql` idempotently renames auth columns.
Tests:
- `packages/db/connection-string.test.ts`
- `packages/db/schema/auth.test.ts`
