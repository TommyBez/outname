import { getVercelOidcToken } from '@vercel/oidc'
import { z } from 'zod'
import {
  type PreparedSkillPackage,
  prepareSkillFiles,
  SkillPackageError,
} from './package'

const SKILLS_SH_API_BASE = 'https://skills.sh/api/v1'
const MAX_SKILL_ID_LENGTH = 512
const SHEBANG_PREFIX = '#!'

const skillsShSkillSchema = z.object({
  id: z.string(),
  installUrl: z.string().nullable(),
  installs: z.number(),
  isDuplicate: z.boolean().optional(),
  name: z.string(),
  slug: z.string(),
  source: z.string(),
  sourceType: z.string(),
  url: z.string(),
})

const skillsShSearchResponseSchema = z.object({
  count: z.number(),
  data: z.array(skillsShSkillSchema),
  durationMs: z.number(),
  query: z.string(),
  searchType: z.string(),
})

const skillsShLeaderboardResponseSchema = z.object({
  data: z.array(skillsShSkillSchema),
  pagination: z.object({
    hasMore: z.boolean(),
    page: z.number(),
    perPage: z.number(),
    total: z.number(),
  }),
})

const skillsShCuratedOwnerSchema = z.object({
  featuredRepo: z.string(),
  featuredSkill: z.string(),
  owner: z.string(),
  skills: z.array(skillsShSkillSchema),
  totalInstalls: z.number(),
})

const skillsShCuratedResponseSchema = z.object({
  data: z.array(skillsShCuratedOwnerSchema),
  generatedAt: z.string(),
  totalOwners: z.number(),
  totalSkills: z.number(),
})

const skillsShDetailResponseSchema = z.object({
  files: z
    .array(
      z.object({
        contents: z.string(),
        path: z.string(),
      })
    )
    .nullable(),
  hash: z.string().nullable(),
  id: z.string(),
  installs: z.number(),
  slug: z.string(),
  source: z.string(),
})

const skillsShAuditResponseSchema = z.object({
  audits: z.array(
    z.object({
      auditedAt: z.string(),
      categories: z.array(z.string()).optional(),
      provider: z.string(),
      riskLevel: z.string().optional(),
      slug: z.string(),
      status: z.string(),
      summary: z.string(),
    })
  ),
  id: z.string(),
  slug: z.string(),
  source: z.string(),
})

export type SkillsShSkill = z.infer<typeof skillsShSkillSchema>
export type SkillsShCuratedOwner = z.infer<typeof skillsShCuratedOwnerSchema>
export type SkillsShCuratedResponse = z.infer<
  typeof skillsShCuratedResponseSchema
>
export type SkillsShSearchResponse = z.infer<
  typeof skillsShSearchResponseSchema
>
export type SkillsShLeaderboardResponse = z.infer<
  typeof skillsShLeaderboardResponseSchema
>
export type SkillsShDetailResponse = z.infer<
  typeof skillsShDetailResponseSchema
>
export type SkillsShAuditResponse = z.infer<typeof skillsShAuditResponseSchema>

export interface ImportedSkillsShSkill {
  detail: SkillsShDetailResponse
  package: PreparedSkillPackage
}

export class SkillsShImportError extends Error {
  readonly status: number | null

  constructor(message: string, options: { status?: number } = {}) {
    super(message)
    this.name = 'SkillsShImportError'
    this.status = options.status ?? null
  }
}

export async function searchSkillsShSkills(input: {
  limit?: number
  query: string
}): Promise<SkillsShSearchResponse> {
  const params = new URLSearchParams({
    q: input.query,
    ...(input.limit === undefined ? {} : { limit: String(input.limit) }),
  })
  return await fetchSkillsShJson(
    `/skills/search?${params.toString()}`,
    skillsShSearchResponseSchema
  )
}

export async function getSkillsShLeaderboard(
  input: {
    page?: number
    perPage?: number
    view?: 'all-time' | 'hot' | 'trending'
  } = {}
): Promise<SkillsShLeaderboardResponse> {
  const params = new URLSearchParams()
  if (input.view) {
    params.set('view', input.view)
  }
  if (input.page !== undefined) {
    params.set('page', String(input.page))
  }
  if (input.perPage !== undefined) {
    params.set('per_page', String(input.perPage))
  }

  const query = params.toString()
  return await fetchSkillsShJson(
    query ? `/skills?${query}` : '/skills',
    skillsShLeaderboardResponseSchema
  )
}

export async function getCuratedSkillsShSkills(): Promise<SkillsShCuratedResponse> {
  return await fetchSkillsShJson(
    '/skills/curated',
    skillsShCuratedResponseSchema
  )
}

export async function getSkillsShSkill(
  id: string
): Promise<SkillsShDetailResponse> {
  return await fetchSkillsShJson(
    `/skills/${encodeSkillsShId(id)}`,
    skillsShDetailResponseSchema
  )
}

export async function getSkillsShSkillAudit(
  id: string
): Promise<SkillsShAuditResponse | null> {
  try {
    return await fetchSkillsShJson(
      `/skills/audit/${encodeSkillsShId(id)}`,
      skillsShAuditResponseSchema
    )
  } catch (error) {
    if (error instanceof SkillsShImportError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function importSkillsShSkill(
  id: string
): Promise<ImportedSkillsShSkill> {
  const detail = await getSkillsShSkill(id)
  if (!detail.files) {
    throw new SkillsShImportError('Skill snapshot is not available.')
  }

  try {
    return {
      detail,
      package: prepareSkillFiles({
        files: detail.files.map((file) => ({
          content: Buffer.from(file.contents, 'utf8'),
          executable: file.contents.startsWith(SHEBANG_PREFIX),
          path: file.path,
        })),
      }),
    }
  } catch (error) {
    if (error instanceof SkillPackageError) {
      throw error
    }
    throw new SkillsShImportError(
      error instanceof Error ? error.message : 'Invalid skills.sh package.'
    )
  }
}

async function fetchSkillsShJson<T>(
  path: string,
  schema: z.ZodType<T>
): Promise<T> {
  const token = await getVercelOidcToken()
  const response = await fetch(`${SKILLS_SH_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  if (!response.ok) {
    throw new SkillsShImportError(
      `skills.sh request failed (${response.status}).`,
      { status: response.status }
    )
  }

  const body = await response.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new SkillsShImportError('skills.sh returned an unexpected response.')
  }
  return parsed.data
}

function encodeSkillsShId(id: string): string {
  if (!id || id.length > MAX_SKILL_ID_LENGTH) {
    throw new SkillsShImportError('Invalid skills.sh skill id.')
  }

  const segments = id.split('/')
  if (
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new SkillsShImportError('Invalid skills.sh skill id.')
  }
  return segments.map((segment) => encodeURIComponent(segment)).join('/')
}
