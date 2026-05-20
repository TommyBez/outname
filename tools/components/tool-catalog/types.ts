import type { ConnectionStatus } from '@/shared/db/schema'

export interface ToolConfigField {
  defaultValue?: string | number | boolean
  description?: string
  label: string
  name: string
  placeholder?: string
  required: boolean
  type: 'text' | 'number' | 'boolean' | 'password'
}

export interface CredentialOverrideFieldGroup {
  displayName: string
  fields: ToolConfigField[]
  hasOverride: boolean
  provider: string
}

export interface ToolCatalogEntry {
  configFields: ToolConfigField[]
  credentialOverrideFields: CredentialOverrideFieldGroup[]
  description: string
  displayName: string
  exposedTools: Array<{
    description: string
    displayName: string
    toolId: string
  }>
  providers: string[]
  toolId: string
  toolSandboxManifest: string | null
}

export interface AttachedToolView {
  config: Record<string, unknown>
  pendingBuildId: string | null
  status: 'connected' | 'pending'
  toolId: string
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
