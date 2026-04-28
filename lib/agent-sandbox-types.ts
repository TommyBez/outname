/**
 * Subset of `Sandbox.create` parameters that we surface through the
 * registry. Defined explicitly (not via `Omit<CreateSandboxParams,...>`)
 * so we don't pick up the snapshot-source variant of the SDK union,
 * which is irrelevant to callers of this helper.
 *
 * Lives in its own module to keep `lib/agent-sandbox.ts` and
 * `lib/agent-sandbox-registry.ts` decoupled — both import this without
 * importing each other.
 */
export interface CreateOptions {
  runtime?: string
  timeout?: number
  ports?: number[]
  resources?: { vcpus: number }
  env?: Record<string, string>
  tags?: Record<string, string>
  snapshotExpiration?: number
}
