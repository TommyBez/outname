import { requireSession } from '@outname/auth/server/auth-guard'
import { AgentSkillsPageContent } from '@outname/shared/agents/components/agent-skills/agent-skills-page-content'
import { toInstalledSkillView } from '@outname/shared/agents/server/skills'
import {
  getCachedAgentByIdForUser,
  getCachedAgentSkills,
} from '@outname/shared/server/data'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent skills',
  'Install and manage Agent Skills for a private OUTNA.ME agent.'
)

export default function AgentSkillsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<SkillsPageSkeleton />}>
      <ResolvedAgentSkillsPage params={params} />
    </Suspense>
  )
}

async function ResolvedAgentSkillsPage({ params }: { params: Params }) {
  const [{ agentId }, session] = await Promise.all([params, requireSession()])
  const [agent, skills] = await Promise.all([
    getCachedAgentByIdForUser(agentId, session.user.id),
    getCachedAgentSkills(agentId),
  ])
  if (!agent) {
    notFound()
  }

  return (
    <AgentSkillsPageContent
      agentId={agent.id}
      agentName={agent.name}
      initialSkills={skills.map(toInstalledSkillView)}
    />
  )
}

function SkillsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-24 w-full animate-pulse bg-muted" />
      <div className="h-20 w-full animate-pulse bg-muted" />
      <div className="h-32 w-full animate-pulse bg-muted" />
    </div>
  )
}
