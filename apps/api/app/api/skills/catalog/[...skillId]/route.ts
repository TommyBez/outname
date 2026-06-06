import {
  getSkillsShSkillAudit,
  importSkillsShSkill,
} from '@outname/ai/agent-runtime/skills/skills-sh-import'
import { auth } from '@outname/auth/server/auth'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ skillId: string[] }>
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { skillId } = await params
  const id = skillId.join('/')

  try {
    const [imported, audit] = await Promise.all([
      importSkillsShSkill(id),
      getSkillsShSkillAudit(id).catch(() => null),
    ])

    return NextResponse.json({
      audit,
      detail: imported.detail,
      package: {
        contentHash: imported.package.contentHash,
        description: imported.package.description,
        fileCount: imported.package.fileCount,
        name: imported.package.name,
        totalBytes: imported.package.totalBytes,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        code: 'catalog_fetch_failed',
        message:
          error instanceof Error
            ? error.message
            : 'Could not load skills catalog detail.',
        ok: false,
      },
      { status: 502 }
    )
  }
}
