import type { ConnectionStatus } from '@/shared/db/schema'

export interface ToolConfigField {
  defaultValue?: string | number | boolean
  description?: string
  label: string
  name: string
  placeholder?: string
  required: boolean
  type: 'text' | 'number' | 'boolean'
}

export interface ToolCatalogEntry {
  /** Pre-described config fields, derived from the maintainer tool's Zod schema. */
  configFields: ToolConfigField[]
  description: string
  displayName: string
  /** Required providers (`resend`, ...) extracted from tool capabilities. */
  providers: string[]
  toolId: string
  /**
   * Phase 4: manifest id this tool requires a tool-sandbox snapshot
   * for. `null` means "no sandbox needed" (e.g. resend_send).
   */
  toolSandboxManifest: string | null
}

export interface AttachedToolView {
  config: Record<string, unknown>
  /**
   * Phase 4: id of the latest in-flight build for this tool's
   * manifest, if any. Set when `status === 'pending'`. The catalog
   * subscribes to its progress stream.
   */
  pendingBuildId: string | null
  /**
   * Phase 4: lifecycle of the attachment row. `pending` means the
   * tool needs a tool sandbox that's still being built; the catalog
   * shows live progress and disables the form until the build
   * finishes.
   */
  status: 'connected' | 'pending'
  toolId: string
  /**
   * Phase 4: sticky error from the last failed build, surfaced
   * alongside a Retry button.
   */
  toolSandboxError: string | null
}

export interface ProviderConnectionView {
  displayName: string
  provider: string
  status: ConnectionStatus | null
}

export interface ProviderState {
  displayName: string
  provider: string
  status: ConnectionStatus | null
}
