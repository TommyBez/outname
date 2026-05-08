'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { attachSubAgentAction, detachToolAction } from '@/tools/actions'

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

/**
 * Phase 4: catalog-style listing of the user's other agents that the
 * parent agent can delegate to via the `agent_<childId>` synthesised
 * tool.
 *
 * Visual language matches `<ToolCatalog />` deliberately — it's the
 * same affordance ("attach/detach a callable") just on a different
 * resource.
 */
export function SubAgentCatalog({ parentAgentId, candidates }: Props) {
  if (candidates.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You don&apos;t have any other agents yet. Create one and it will appear
        here as a delegation target.
      </p>
    )
  }

  return (
    <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
      {candidates.map((c) => (
        <li className="py-6" key={c.agentId}>
          <SubAgentRow entry={c} parentAgentId={parentAgentId} />
        </li>
      ))}
    </ul>
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
  const router = useRouter()
  const attached = entry.attachedToolId !== null

  function handleAttach() {
    startTransition(async () => {
      const res = await attachSubAgentAction(parentAgentId, entry.agentId)
      if (!res.ok) {
        toast.error(res.error ?? 'Attach failed.')
        return
      }
      toast.success('Sub-agent attached.')
      router.refresh()
    })
  }

  function handleDetach() {
    startTransition(async () => {
      const res = await detachToolAction(
        parentAgentId,
        entry.attachedToolId ?? entry.displayToolId,
        'sub_agent'
      )
      if (!res.ok) {
        toast.error(res.error ?? 'Detach failed.')
        return
      }
      toast.success('Sub-agent detached.')
      router.refresh()
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
              Currently disabled — turn it on from its overview page before
              attaching, or attach now and re-enable later.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!attached && (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            disabled={pending}
            onClick={handleAttach}
            type="button"
          >
            {pending ? '...' : 'Attach'}
          </button>
        )}
        {attached && (
          <button
            className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
            disabled={pending}
            onClick={handleDetach}
            type="button"
          >
            {pending ? '...' : 'Detach'}
          </button>
        )}
        {attached && (
          <span
            className="inline-flex h-10 items-center border-2 border-foreground bg-foreground px-3 font-bold text-[10px] text-background uppercase tracking-[0.16em]"
            role="status"
          >
            Attached
          </span>
        )}
      </div>
    </div>
  )
}
