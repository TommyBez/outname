import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-guard'
import { revalidateTag } from 'next/cache'
import { userConnectionsTag } from '@/lib/cache-tags'
import { disconnectProvider } from '@/connectors/runtime'
import { getConnector } from '@/connectors/registry'

export async function POST(
  _request: Request,
  context: { params: Promise<{ provider: string }> }
) {
  const userId = await requireUserId()
  const { provider } = await context.params

  if (!getConnector(provider)) {
    return NextResponse.json(
      { error: 'unknown_provider' },
      { status: 404 }
    )
  }

  await disconnectProvider({ userId, provider })

  revalidateTag(userConnectionsTag(userId), 'max')

  return NextResponse.json({ ok: true })
}
