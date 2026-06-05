import { auth } from '@outname/auth/server/auth'
import {
  installSkillForUser,
  type SkillInstallSource,
  toInstalledSkillView,
} from '@outname/shared/agents/server/skills'
import {
  getAgentByIdForUser,
  getAgentSkills,
} from '@outname/shared/server/data'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ agentId: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { agentId } = await params
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const skills = await getAgentSkills(agentId)
  return NextResponse.json({ skills: skills.map(toInstalledSkillView) })
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { agentId } = await params
  const body = await readInstallForm(req)
  if (!body.ok) {
    return body.response
  }

  const result = await installSkillForUser({
    agentId,
    replace: body.replace,
    source: body.source,
    userId: session.user.id,
  })

  return NextResponse.json(result, {
    status: result.ok ? 200 : statusForErrorCode(result.code),
  })
}

async function readInstallForm(
  req: NextRequest
): Promise<
  | { ok: true; replace: boolean; source: SkillInstallSource }
  | { ok: false; response: ReturnType<typeof NextResponse.json> }
> {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: 'invalid_request',
          message: 'Expected multipart form data.',
          ok: false,
        },
        { status: 400 }
      ),
    }
  }

  const kind = form.get('kind')
  const replace = form.get('replace') === 'true'
  if (kind === 'github') {
    const url = form.get('url')
    if (typeof url !== 'string' || !url.trim()) {
      return invalidRequest('GitHub URL is required.')
    }
    return {
      ok: true,
      replace,
      source: { type: 'github', url: url.trim() },
    }
  }

  if (kind === 'skill_md' || kind === 'zip') {
    const file = form.get('file')
    if (!isFormFile(file)) {
      return invalidRequest('File upload is required.')
    }
    const content = Buffer.from(await file.arrayBuffer())
    return {
      ok: true,
      replace,
      source: { content, type: kind },
    }
  }

  return invalidRequest('Unsupported skill source.')
}

function invalidRequest(message: string): {
  ok: false
  response: ReturnType<typeof NextResponse.json>
} {
  return {
    ok: false,
    response: NextResponse.json(
      { code: 'invalid_request', message, ok: false },
      { status: 400 }
    ),
  }
}

function isFormFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    'arrayBuffer' in value &&
    typeof value.arrayBuffer === 'function'
  )
}

function statusForErrorCode(code: string): number {
  switch (code) {
    case 'agent_not_found':
      return 404
    case 'name_conflict':
      return 409
    case 'sandbox_unavailable':
      return 503
    default:
      return 400
  }
}
