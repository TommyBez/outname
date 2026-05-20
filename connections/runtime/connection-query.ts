import { and, eq } from 'drizzle-orm'
import { userConnections } from '@/shared/db/schema'

export function connectionFilter(args: {
  connectorId: string
  userId: string
}) {
  return and(
    eq(userConnections.userId, args.userId),
    eq(userConnections.connectorId, args.connectorId)
  )
}
