# Inference Providers
Scope: User-scoped inference credentials, provider/model selection, model catalogs, and actual cost lookup.
Flow:
- Settings trim and verify API keys when a non-billable endpoint exists, then encrypt `{ apiKey }`.
- Runtime reads an enabled user credential from Redis cache or Postgres, decrypts it, and creates the provider model.
- Model catalogs fetch live tool-capable models, cache for one hour, and fall back on errors.
- Vercel actual cost lookup retries generation lookup at 0, 1, and 3 seconds with a 2-second timeout.
State:
- Providers are `vercel-ai-gateway`, `llm-gateway`, and `openrouter`.
- `user_inference_credentials` is keyed by `(user_id, inference_provider)` with encrypted credentials and status.
- `user.default_inference_provider`, `agent.inference_provider`, and `agent.model` persist provider-scoped selection.
Anchors:
- `packages/shared/server/inference-credentials.ts`, `inference-language-model.ts`, `inference-models.ts`
- `packages/shared/server/inference-provider-registry.ts`, `inference-provider-verify.ts`, `inference-actual-costs.ts`
- `packages/db/schema/inference.ts`, `packages/db/schema/agents.ts`, `packages/auth/settings/actions.ts`
Invariants:
- Provider and model must be persisted together; model ids are not globally meaningful.
- There is no server fallback key; missing or non-enabled credentials throw `MissingInferenceCredentialError`.
- Setting a default provider requires an enabled credential; first saved key becomes default if none exists.
Failure modes:
- Verification failure returns a form error before persistence.
- Clearing the default key switches to the sole remaining enabled provider or clears the default.
- Live catalog failure uses fallback; fallback catalogs allow any selected model id.
