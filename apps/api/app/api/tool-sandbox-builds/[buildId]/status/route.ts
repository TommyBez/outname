import { getSession } from '@outname/auth/server/auth-guard'
import { db } from '@outname/db'
import { agent, agentTools, toolSandboxBuilds } from '@outname/db/schema'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ buildId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { buildId } = await params
  const [build] = await db
    .select({
      status: toolSandboxBuilds.status,
      errorText: toolSandboxBuilds.errorText,
      manifestId: toolSandboxBuilds.manifestId,
    })
    .from(toolSandboxBuilds)
    .where(eq(toolSandboxBuilds.id, buildId))
    .limit(1)
  if (!build) {
    return NextResponse.json(null, { status: 404 })
  }

  const [ownerRow] = await db
    .select({ agentId: agentTools.agentId })
    .from(agentTools)
    .innerJoin(agent, eq(agent.id, agentTools.agentId))
    .where(
      and(
        eq(agentTools.toolSandboxManifest, build.manifestId),
        eq(agent.userId, session.user.id)
      )
    )
    .limit(1)
  if (!ownerRow) {
    return NextResponse.json({ status: 'forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    status: build.status,
    errorText: build.errorText,
  })
}
