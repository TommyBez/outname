# Provider Authoring
Scope: Adding or changing inference providers and model catalogs.
Provider registry:
- Add provider ids to `inferenceProviderValues` and `PROVIDER_DEFINITIONS` together.
- `createLanguageModel` must use the user's saved key; there is no server fallback key.
- Optional verification should use non-billable endpoints; LLM Gateway currently skips verification.
- Provider and model ids must be stored together because model ids are provider-scoped.
Model catalogs:
- Catalogs fetch Vercel AI Gateway, LLM Gateway, and OpenRouter live endpoints with one-hour revalidation.
- Vercel keeps `type: language` models tagged `tool-use`.
- OpenRouter keeps models with `supported_parameters` including `tools` and excludes `openrouter/*`.
- LLM Gateway keeps models where at least one provider advertises `tools: true`.
- Empty or failed live catalogs fall back; fallback source treats selected model ids as valid.
Cost accounting:
- OpenRouter and LLM Gateway actual costs come from documented response usage fields.
- Vercel AI Gateway actual cost uses generation lookup with delays `0ms`, `1000ms`, `3000ms` and a `2000ms` timeout.
Anchors:
- `packages/shared/server/inference-provider-registry.ts`, `packages/shared/server/inference-models.ts`
- `packages/shared/server/inference-credentials.ts`, `packages/shared/server/inference-actual-costs.ts`
- Tests: `packages/shared/server/inference-providers.test.ts`, `packages/shared/server/inference-models.test.ts`
- Tests: `packages/shared/server/inference-actual-costs.test.ts`
