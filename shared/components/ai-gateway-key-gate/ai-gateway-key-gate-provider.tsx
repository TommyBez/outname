'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { MissingAiGatewayKeyDialog } from './missing-ai-gateway-key-dialog'

interface AiGatewayKeyGateContextValue {
  hasKey: boolean
  markHasKey: () => void
  markMissingKey: () => void
  requireAiGatewayKey: () => boolean
}

const AiGatewayKeyGateContext =
  createContext<AiGatewayKeyGateContextValue | null>(null)

export function AiGatewayKeyGateProvider({
  children,
  initialHasKey,
}: {
  children: React.ReactNode
  initialHasKey: boolean
}) {
  const [hasKey, setHasKey] = useState(initialHasKey)
  const [dialogOpen, setDialogOpen] = useState(false)

  const markHasKey = useCallback(() => {
    setHasKey(true)
    setDialogOpen(false)
  }, [])

  const markMissingKey = useCallback(() => {
    setHasKey(false)
  }, [])

  const requireAiGatewayKey = useCallback(() => {
    if (hasKey) {
      return true
    }
    setDialogOpen(true)
    return false
  }, [hasKey])

  const value = useMemo(
    () => ({
      hasKey,
      markHasKey,
      markMissingKey,
      requireAiGatewayKey,
    }),
    [hasKey, markHasKey, markMissingKey, requireAiGatewayKey]
  )

  return (
    <AiGatewayKeyGateContext.Provider value={value}>
      {children}
      <MissingAiGatewayKeyDialog
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </AiGatewayKeyGateContext.Provider>
  )
}

export function useAiGatewayKeyGate(): AiGatewayKeyGateContextValue {
  const context = useContext(AiGatewayKeyGateContext)
  if (!context) {
    throw new Error(
      'useAiGatewayKeyGate must be used within AiGatewayKeyGateProvider'
    )
  }
  return context
}

export function useOptionalAiGatewayKeyGate(): AiGatewayKeyGateContextValue | null {
  return useContext(AiGatewayKeyGateContext)
}
