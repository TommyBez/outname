# Revalidation Flow

Scope: how mutations refresh cached app state locally and across projects.

Flow:
- App-local mutations call `revalidateTag`, `updateTag`, and `revalidatePath` directly.
- API-project mutations call `revalidateAppAfter(...)` for app-visible cached state.
- `revalidateAppAfter` schedules `sendAppRevalidation(...)` with `after(...)`.
- Sender signs JSON with `APP_REVALIDATION_SECRET`.
- Sender POSTs to app `/api/internal/revalidate`.
- App route verifies `x-outname-revalidation-signature`.
- Valid payload revalidates every tag and optional path.

Payload contract:
- `tags` is required and is a list of `[tag, profile]`.
- `profile` is `'max'` or `{ expire: 0 }`.
- `paths` is optional and every path must start with `/`.
- Empty tag and path payloads are no-ops.

Failure modes:
- Bad/missing signature returns 401.
- Bad JSON or invalid payload returns 400.
- Direct send throws on non-OK; after-send logs failures.

Anchors: `packages/shared/server/app-revalidation*.ts`,
`apps/app/app/api/internal/revalidate/route.ts`.
