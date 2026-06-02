import { userConnections } from '@outname/db/schema'
import { and, eq } from 'drizzle-orm'

export function connectionFilter(args: {
  connectorId: string
  userId: string
}) {
  return and(
    eq(userConnections.userId, args.userId),
    eq(userConnections.connectorId, args.connectorId)
  )
}
