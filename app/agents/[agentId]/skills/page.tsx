import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  SkillCatalog,
  type SkillCatalogEntry,
} from '@/components/skill-catalog'
import { requireSession } from '@/lib/auth-guard'
import {
  getCachedAgentByIdForUser,
  getCachedAgentSkillSummaries,
} from '@/lib/data'

type Params = Promise<{ agentId: string }>

export default function AgentSkillsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Resolved params={params} />
    </Suspense>
  )
}

async function Resolved({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const summaries = await getCachedAgentSkillSummaries(agentId)
  const skills: SkillCatalogEntry[] = summaries.map((s) => ({
    name: s.name,
    description: s.description,
    sourceType: s.sourceType,
    sourceRef: s.sourceRef,
    status: s.status,
    error: s.error,
    fileCount: s.fileCount,
    updatedAt: s.updatedAt.toISOString(),
  }))

  return (
    <>
      <header className="mb-12 border-foreground border-t-4 pt-6">
        <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(16rem,3fr)]">
          <div className="flex flex-col gap-4">
            <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
              {agent.name}
            </p>
            <h1 className="font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter md:text-7xl">
              Skills
            </h1>
            <p className="text-muted-foreground text-sm">
              Add agent skills as a SKILL.md file, a zip bundle, or a public
              GitHub link. Skills are mirrored into the agent&apos;s exec
              sandbox at <code>/workspace/skills/&lt;name&gt;/</code> on every
              session boot, and exposed to the model via a <code>skill</code>{' '}
              tool that loads <code>SKILL.md</code> on demand — the same shape
              as bash-tool&apos;s <code>createSkillTool</code>, just backed by a
              Vercel Sandbox file system instead of the local codebase.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-3 border-foreground border-l-2 pl-4 md:justify-end">
            <Link
              className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
              href={`/agents/${agentId}`}
            >
              ← Overview
            </Link>
            <Link
              className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
              href={`/agents/${agentId}/tools`}
            >
              Tools →
            </Link>
          </div>
        </div>
      </header>

      <SkillCatalog agentId={agentId} skills={skills} />
    </>
  )
}

function PageSkeleton() {
  return (
    <header className="mb-12 border-foreground border-t-4 pt-6">
      <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
      <div className="mt-4 h-12 w-64 animate-pulse rounded-sm bg-muted" />
    </header>
  )
}
