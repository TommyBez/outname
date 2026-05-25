import { getSession } from '@/auth/server/auth-guard'
import { hasUserAiGatewayApiKey } from '@/shared/server/ai-gateway-byok'
import { AiGatewayKeyGateProvider } from './ai-gateway-key-gate-provider'

export async function AiGatewayKeyGateRoot({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) {
    return children
  }

  const hasKey = await hasUserAiGatewayApiKey(session.user.id)
  return (
    <AiGatewayKeyGateProvider initialHasKey={hasKey}>
      {children}
    </AiGatewayKeyGateProvider>
  )
}
