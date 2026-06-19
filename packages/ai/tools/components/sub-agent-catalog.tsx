'use client'

import { Button } from '@outname/ui/components/ui/button'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

export interface SubAgentCatalogEntry {
  agentId: string
  attachedToolId: string | null
  displayToolId: string
  enabled: boolean
  name: string
}

interface Props {
  candidates: SubAgentCatalogEntry[]
  parentAgentId: string
}

interface ToolMutationResult {
  error?: string
  ok: boolean
}

export function SubAgentCatalog({ parentAgentId, candidates }: Props) {
  if (candidates.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You don&apos;t have any other agents yet. Create one and it will appear
        here as a delegation target.
      </p>
    )
  }

  const attachedCandidates = candidates.filter(
    (candidate) => candidate.attachedToolId !== null
  )
  const availableCandidates = candidates.filter(
    (candidate) => candidate.attachedToolId === null
  )

  return (
    <div className="flex flex-col gap-10">
      <SubAgentSection
        candidates={attachedCandidates}
        emptyText="No sub-agents are attached to this agent yet."
        parentAgentId={parentAgentId}
        title="Attached sub-agents"
      />
      <SubAgentSection
        candidates={availableCandidates}
        emptyText="Every available sub-agent is already attached."
        parentAgentId={parentAgentId}
        title="Available sub-agents"
      />
    </div>
  )
}

function SubAgentSection({
  candidates,
  emptyText,
  parentAgentId,
  title,
}: {
  candidates: SubAgentCatalogEntry[]
  emptyText: string
  parentAgentId: string
  title: string
}) {
  return (
    <section>
      <h3 className="swiss-label mb-4 text-brand">{title}</h3>
      {candidates.length === 0 ? (
        <p className="border-border border-y py-6 text-muted-foreground text-sm">
          {emptyText}
        </p>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-foreground border-border border-y">
          {candidates.map((candidate) => (
            <li className="py-6" key={candidate.agentId}>
              <SubAgentRow entry={candidate} parentAgentId={parentAgentId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SubAgentRow({
  parentAgentId,
  entry,
}: {
  parentAgentId: string
  entry: SubAgentCatalogEntry
}) {
  const [pending, startTransition] = useTransition()
  const { refresh } = useRouter()
  const attached = entry.attachedToolId !== null

  function handleAttach() {
    startTransition(async () => {
      const res = await attachSubAgent(parentAgentId, entry.agentId)
      if (!res.ok) {
        toast.error(res.error ?? 'Attach failed.')
        return
      }
      toast.success('Sub-agent attached.')
      refresh()
    })
  }

  function handleDetach() {
    startTransition(async () => {
      const res = await detachSubAgentTool(
        parentAgentId,
        entry.attachedToolId ?? entry.displayToolId
      )
      if (!res.ok) {
        toast.error(res.error ?? 'Detach failed.')
        return
      }
      toast.success('Sub-agent detached.')
      refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0">
          <p className="font-black font-mono text-sm uppercase tracking-[0.04em]">
            {entry.displayToolId}
          </p>
          <p className="mt-1 font-black font-serif text-xl uppercase tracking-[-0.04em]">
            {entry.name}
          </p>
          {!entry.enabled && (
            <p className="mt-2 font-bold text-[10px] text-destructive uppercase tracking-[0.2em]">
              Currently disabled, turn it on from its overview page before
              attaching, or attach now and re-enable later.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!attached && (
          <Button
            className="inline-flex h-10 items-center justify-center border border-border bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            disabled={pending}
            onClick={handleAttach}
            size="sm"
            type="button"
          >
            {pending ? '...' : 'Attach'}
          </Button>
        )}
        {attached && (
          <Button
            className="inline-flex h-10 items-center justify-center border border-border px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
            disabled={pending}
            onClick={handleDetach}
            size="sm"
            type="button"
            variant="outline"
          >
            {pending ? '...' : 'Detach'}
          </Button>
        )}
        {attached && (
          <output className="inline-flex h-10 items-center border border-border bg-foreground px-3 font-bold text-[10px] text-background uppercase tracking-[0.16em]">
            Attached
          </output>
        )}
      </div>
    </div>
  )
}

async function attachSubAgent(
  parentAgentId: string,
  childAgentId: string
): Promise<ToolMutationResult> {
  const res = await fetch(
    `/api/agents/${encodeURIComponent(parentAgentId)}/sub-agents/${encodeURIComponent(childAgentId)}`,
    { method: 'POST' }
  )
  return await readToolMutationResult(res)
}

async function detachSubAgentTool(
  parentAgentId: string,
  toolId: string
): Promise<ToolMutationResult> {
  const res = await fetch(
    `/api/agents/${encodeURIComponent(parentAgentId)}/tools/${encodeURIComponent(toolId)}?kind=sub_agent`,
    { method: 'DELETE' }
  )
  return await readToolMutationResult(res)
}

async function readToolMutationResult(
  res: Response
): Promise<ToolMutationResult> {
  const body = (await res.json().catch(() => null)) as ToolMutationResult | null
  if (body && typeof body.ok === 'boolean') {
    return body
  }
  return { ok: false, error: `Request failed (${res.status})` }
}
