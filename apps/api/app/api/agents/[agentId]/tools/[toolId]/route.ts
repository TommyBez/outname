import { detachToolForUser } from '@outname/ai/tools/server/attachment-service/detach'
import { attachMaintainerToolForUser } from '@outname/ai/tools/server/attachment-service/maintainer'
import { auth } from '@outname/auth/server/auth'
import { revalidateAppAfter } from '@outname/shared/server/app-revalidation-after'
import {
  agentTag,
  agentToolsTag,
  userAgentsTag,
} from '@outname/shared/server/cache-tags'
import { ensureToolSandboxBuild } from '@outname/workflow/tool-sandbox-builds/build'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

type DetachKind = 'maintainer' | 'sub_agent'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string; toolId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { agentId, toolId } = await params
  const body = await readJson(req)
  if (!body.ok) {
    return body.response
  }

  const result = await attachMaintainerToolForUser({
    agentId,
    ensureSandboxBuild: ensureToolSandboxBuild,
    rawConfig: readConfig(body.value),
    toolId,
    userId: session.user.id,
  })
  if (result.ok) {
    revalidateToolSurfaces(agentId, session.user.id)
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string; toolId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { agentId, toolId } = await params
  const kind = readDetachKind(req.nextUrl.searchParams.get('kind'))
  const result = await detachToolForUser({
    agentId,
    kind,
    toolId,
    userId: session.user.id,
  })
  if (result.ok) {
    revalidateToolSurfaces(agentId, session.user.id)
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}

async function readJson(
  req: NextRequest
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; response: ReturnType<typeof NextResponse.json> }
> {
  try {
    return { ok: true, value: await req.json() }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'invalid json' }, { status: 400 }),
    }
  }
}

function readConfig(value: unknown): Record<string, unknown> {
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'config' in value
  ) {
    const config = Reflect.get(value, 'config')
    if (
      typeof config === 'object' &&
      config !== null &&
      !Array.isArray(config)
    ) {
      return config as Record<string, unknown>
    }
  }
  return {}
}

function readDetachKind(value: string | null): DetachKind {
  return value === 'sub_agent' ? 'sub_agent' : 'maintainer'
}

function revalidateToolSurfaces(agentId: string, userId: string): void {
  revalidateAppAfter([
    [agentToolsTag(agentId), 'max'],
    [agentTag(agentId), 'max'],
    [userAgentsTag(userId), 'max'],
  ])
}
