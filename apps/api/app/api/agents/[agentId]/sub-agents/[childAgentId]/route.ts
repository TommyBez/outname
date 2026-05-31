import { attachSubAgentForUser } from '@outname/ai/tools/server/attachment-service/sub-agent'
import { auth } from '@outname/auth/server/auth'
import { revalidateAppAfter } from '@outname/shared/server/app-revalidation-after'
import {
  agentTag,
  agentToolsTag,
  userAgentsTag,
} from '@outname/shared/server/cache-tags'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ agentId: string; childAgentId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { agentId, childAgentId } = await params
  const result = await attachSubAgentForUser({
    childAgentId,
    parentAgentId: agentId,
    userId: session.user.id,
  })
  if (result.ok) {
    revalidateAppAfter([
      [agentToolsTag(agentId), 'max'],
      [agentTag(agentId), 'max'],
      [userAgentsTag(session.user.id), 'max'],
    ])
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
