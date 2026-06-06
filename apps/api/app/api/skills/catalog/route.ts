import {
  getCuratedSkillsShSkills,
  getSkillsShLeaderboard,
  type SkillsShSkill,
  searchSkillsShSkills,
} from '@outname/ai/agent-runtime/skills/skills-sh-import'
import { auth } from '@outname/auth/server/auth'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

const SEARCH_LIMIT = 50

interface CatalogSkillView {
  id: string
  installs: number
  installUrl: string | null
  isDuplicate?: boolean
  name: string
  owner: string | null
  slug: string
  source: string
  sourceType: string
  url: string
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const curated = searchParams.get('curated') === 'true'
  const query = searchParams.get('query')?.trim() ?? ''

  try {
    if (curated) {
      const result = await getCuratedSkillsShSkills()
      const skills = result.data.flatMap((owner) =>
        owner.skills.map((skill) => toCatalogSkillView(skill, owner.owner))
      )
      return NextResponse.json({
        curated: true,
        generatedAt: result.generatedAt,
        skills: sortSkillsByInstalls(skills),
        totalSkills: result.totalSkills,
      })
    }

    if (query.length < 2) {
      const result = await getSkillsShLeaderboard({
        page: 0,
        perPage: SEARCH_LIMIT,
        view: 'all-time',
      })
      return NextResponse.json({
        curated: false,
        query,
        searchType: 'leaderboard',
        skills: result.data.map((skill) => toCatalogSkillView(skill, null)),
        totalSkills: result.pagination.total,
      })
    }

    const result = await searchSkillsShSkills({
      limit: SEARCH_LIMIT,
      query,
    })
    return NextResponse.json({
      curated: false,
      query: result.query,
      searchType: result.searchType,
      skills: result.data.map((skill) => toCatalogSkillView(skill, null)),
      totalSkills: result.count,
    })
  } catch (error) {
    return catalogErrorResponse(error)
  }
}

function sortSkillsByInstalls(skills: CatalogSkillView[]): CatalogSkillView[] {
  return [...skills].sort((a, b) => {
    const installsDiff = b.installs - a.installs
    if (installsDiff !== 0) {
      return installsDiff
    }
    return a.name.localeCompare(b.name)
  })
}

function toCatalogSkillView(
  skill: SkillsShSkill,
  owner: string | null
): CatalogSkillView {
  return {
    id: skill.id,
    installUrl: skill.installUrl,
    installs: skill.installs,
    isDuplicate: skill.isDuplicate,
    name: skill.name,
    owner,
    slug: skill.slug,
    source: skill.source,
    sourceType: skill.sourceType,
    url: skill.url,
  }
}

function catalogErrorResponse(error: unknown): NextResponse {
  console.error('Skills catalog request failed', { error })
  return NextResponse.json(
    {
      code: 'catalog_fetch_failed',
      message: 'Could not load skills catalog.',
      ok: false,
    },
    { status: 502 }
  )
}
