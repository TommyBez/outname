export type ConnectionStatus = 'active' | 'invalid'

export interface ProviderRequirement {
  provider: string
  toolId: string
}

export interface ConnectionStatusView {
  exists: boolean
  expiresAt: Date | null
  lastError: string | null
  metadata: Record<string, unknown>
  status: ConnectionStatus | null
}

export interface UserConnectionView {
  createdAt: Date
  expiresAt: Date | null
  lastError: string | null
  metadata: Record<string, unknown>
  provider: string
  status: ConnectionStatus
}
