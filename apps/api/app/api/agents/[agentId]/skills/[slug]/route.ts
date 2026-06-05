import { auth } from '@outname/auth/server/auth'
import { uninstallSkillForUser } from '@outname/shared/agents/server/skills'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ agentId: string; slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { agentId, slug } = await params
  const result = await uninstallSkillForUser({
    agentId,
    slug,
    userId: session.user.id,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
