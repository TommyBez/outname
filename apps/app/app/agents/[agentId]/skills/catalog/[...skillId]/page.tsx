import {
  getSkillsShSkillAudit,
  type ImportedSkillsShSkill,
  importSkillsShSkill,
  type SkillsShAuditResponse,
  SkillsShImportError,
} from '@outname/ai/agent-runtime/skills/skills-sh-import'
import { requireSession } from '@outname/auth/server/auth-guard'
import { SkillCatalogInstallButton } from '@outname/shared/agents/components/agent-skills/skill-catalog-install-button'
import {
  getCachedAgentByIdForUser,
  getCachedAgentSkills,
} from '@outname/shared/server/data'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { Badge } from '@outname/ui/components/ui/badge'
import { Button } from '@outname/ui/components/ui/button'
import { ArrowLeft, ExternalLink, FileCode2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

type Params = Promise<{ agentId: string; skillId: string[] }>

const SKILL_INTEGER_FORMATTER = new Intl.NumberFormat()

export const metadata = createPrivatePageMetadata(
  'Skill catalog detail',
  'Review and install a catalog Agent Skill for a private OUTNA.ME agent.'
)

export default function SkillCatalogDetailPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<SkillCatalogDetailSkeleton />}>
      <ResolvedSkillCatalogDetailPage params={params} />
    </Suspense>
  )
}

async function ResolvedSkillCatalogDetailPage({ params }: { params: Params }) {
  const [{ agentId, skillId }, session] = await Promise.all([
    params,
    requireSession(),
  ])
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const catalogSkillId = catalogSkillIdFromSegments(skillId)
  const [catalogSkill, audit, installedSkills] = await Promise.all([
    loadCatalogSkill(catalogSkillId),
    getSkillsShSkillAudit(catalogSkillId).catch(() => null),
    getCachedAgentSkills(agentId),
  ])
  if (!catalogSkill) {
    notFound()
  }

  const installedSkill =
    installedSkills.find(
      (skill) =>
        skill.nameNormalized === catalogSkill.package.nameNormalized ||
        (skill.sourceType === 'skills_sh' &&
          skill.sourcePath === catalogSkill.detail.id)
    ) ?? null

  return (
    <SkillCatalogDetailContent
      agentId={agent.id}
      audit={audit}
      catalogSkill={catalogSkill}
      installedSkill={
        installedSkill
          ? {
              description: installedSkill.description,
              name: installedSkill.name,
              slug: installedSkill.slug,
            }
          : null
      }
    />
  )
}

function SkillCatalogDetailContent({
  agentId,
  audit,
  catalogSkill,
  installedSkill,
}: {
  agentId: string
  audit: SkillsShAuditResponse | null
  catalogSkill: ImportedSkillsShSkill
  installedSkill: {
    description: string
    name: string
    slug: string
  } | null
}) {
  const { detail } = catalogSkill
  const skillPackage = catalogSkill.package
  const sourceUrl = `https://skills.sh/${encodeCatalogSkillIdForPath(detail.id)}`
  const extraFiles = skillPackage.files.filter(
    (file) => file.path !== 'SKILL.md'
  )

  return (
    <div className="flex flex-col gap-6">
      <Button asChild className="w-fit gap-2" size="sm" variant="outline">
        <Link href={`/agents/${encodeURIComponent(agentId)}/skills`}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to skills
        </Link>
      </Button>

      <header className="grid gap-5 border-foreground border-t-4 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="min-w-0">
          <p className="swiss-label mb-4 text-accent">
            skills / {detail.source}
          </p>
          <h1 className="break-words font-black font-serif text-4xl uppercase leading-[0.9] tracking-tighter sm:text-5xl lg:text-6xl">
            {skillPackage.name}
          </h1>
          <p className="mt-5 max-w-3xl border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
            {skillPackage.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="outline">
              {formatInteger(detail.installs)} installs
            </Badge>
            <Badge variant="secondary">
              {skillPackage.fileCount} files ·{' '}
              {formatBytes(skillPackage.totalBytes)}
            </Badge>
            <AuditBadge audit={audit} />
          </div>
        </div>

        <aside className="grid content-start gap-4 border-2 border-foreground p-4">
          <div>
            <p className="font-black text-xs uppercase tracking-[0.16em]">
              Installation
            </p>
            <p className="mt-2 text-muted-foreground text-sm">
              Install this catalog skill into the agent&apos;s dedicated Skill
              Sandbox.
            </p>
          </div>
          <SkillCatalogInstallButton
            agentId={agentId}
            installedSkill={installedSkill}
            skillId={detail.id}
          />
          <Button asChild className="gap-2" size="sm" variant="outline">
            <a href={sourceUrl} rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden className="size-4" />
              Open on skills.sh
            </a>
          </Button>
        </aside>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Source" value={detail.source} />
        <Metric label="Catalog ID" value={detail.id} />
        <Metric label="Snapshot" value={detail.hash ?? 'Unavailable'} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <article className="grid gap-3 border-2 border-foreground p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-black font-serif text-2xl uppercase leading-none tracking-tighter">
              SKILL.md
            </h2>
            <Badge variant="outline">Preview</Badge>
          </div>
          <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap break-words bg-muted p-4 font-mono text-xs leading-relaxed">
            {skillPackage.instructions || 'No additional instructions.'}
          </pre>
        </article>

        <aside className="grid gap-5">
          <section className="grid gap-3 border-2 border-foreground p-4">
            <h2 className="font-black font-serif text-xl uppercase leading-none tracking-tighter">
              Package files
            </h2>
            {extraFiles.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                This package only contains SKILL.md.
              </p>
            ) : (
              <div className="grid gap-2">
                {extraFiles.map((file) => (
                  <div
                    className="grid gap-1 border-foreground border-l-2 pl-3"
                    key={file.path}
                  >
                    <div className="flex items-center gap-2">
                      <FileCode2
                        aria-hidden
                        className="size-4 shrink-0 text-accent"
                      />
                      <span className="break-all font-mono text-xs">
                        {file.path}
                      </span>
                    </div>
                    {file.executable && (
                      <Badge className="w-fit" variant="secondary">
                        executable
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-3 border-2 border-foreground p-4">
            <h2 className="font-black font-serif text-xl uppercase leading-none tracking-tighter">
              Security audits
            </h2>
            <AuditList audit={audit} />
          </section>
        </aside>
      </section>
    </div>
  )
}

function AuditBadge({ audit }: { audit: SkillsShAuditResponse | null }) {
  const audits = audit?.audits ?? []
  if (audits.length === 0) {
    return (
      <Badge className="gap-1" variant="outline">
        <ShieldCheck aria-hidden className="size-3" />
        No audit yet
      </Badge>
    )
  }

  const hasFail = audits.some((item) => item.status === 'fail')
  const hasWarn = audits.some((item) => item.status === 'warn')
  return (
    <Badge
      className="gap-1"
      variant={hasFail || hasWarn ? 'secondary' : 'outline'}
    >
      <ShieldCheck aria-hidden className="size-3" />
      {auditStatusLabel({ hasFail, hasWarn })}
    </Badge>
  )
}

function AuditList({ audit }: { audit: SkillsShAuditResponse | null }) {
  const audits = audit?.audits ?? []
  if (audits.length === 0) {
    return <p className="text-muted-foreground text-sm">No audit available.</p>
  }

  return (
    <div className="grid gap-3">
      {audits.map((item) => (
        <div
          className="grid gap-1 border-foreground border-l-2 pl-3"
          key={`${item.provider}-${item.slug}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm">{item.provider}</span>
            <Badge variant={item.status === 'pass' ? 'outline' : 'secondary'}>
              {item.status}
            </Badge>
            {item.riskLevel && (
              <Badge variant="secondary">{item.riskLevel}</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">{item.summary}</p>
        </div>
      ))}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-2 border-foreground p-4">
      <p className="font-bold text-muted-foreground text-xs uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-2 truncate font-mono text-sm">{value}</p>
    </div>
  )
}

async function loadCatalogSkill(
  id: string
): Promise<ImportedSkillsShSkill | null> {
  try {
    return await importSkillsShSkill(id)
  } catch (error) {
    if (error instanceof SkillsShImportError && error.status === 404) {
      return null
    }
    throw error
  }
}

function catalogSkillIdFromSegments(segments: string[]): string {
  if (
    segments.length === 0 ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    notFound()
  }
  return segments.join('/')
}

function encodeCatalogSkillIdForPath(skillId: string): string {
  return skillId
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatInteger(value: number): string {
  return SKILL_INTEGER_FORMATTER.format(value)
}

function auditStatusLabel(input: {
  hasFail: boolean
  hasWarn: boolean
}): string {
  if (input.hasFail) {
    return 'Audit fail'
  }
  if (input.hasWarn) {
    return 'Audit warning'
  }
  return 'Audit pass'
}

function SkillCatalogDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-9 w-36 animate-pulse bg-muted" />
      <div className="h-44 w-full animate-pulse bg-muted" />
      <div className="h-20 w-full animate-pulse bg-muted" />
      <div className="h-96 w-full animate-pulse bg-muted" />
    </div>
  )
}
