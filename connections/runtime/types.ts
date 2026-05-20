export type ConnectionStatus = 'active' | 'invalid'

export interface ConnectorRequirement {
  connectorId: string
  requiredScopes?: readonly string[]
  toolId: string
}

export interface ConnectionStatusView {
  exists: boolean
  expiresAt: Date | null
  grantedScopes: string[]
  lastError: string | null
  metadata: Record<string, unknown>
  status: ConnectionStatus | null
}

export interface UserConnectionView {
  connectorId: string
  createdAt: Date
  expiresAt: Date | null
  grantedScopes: string[]
  lastError: string | null
  metadata: Record<string, unknown>
  status: ConnectionStatus
}
