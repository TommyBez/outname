'use client'

import { ToolRow } from '@/tools/components/tool-catalog/tool-row'
import type {
  AttachedToolView as AttachedToolViewType,
  ConnectorConnectionView as ConnectorConnectionViewType,
  ToolCatalogEntry as ToolCatalogEntryType,
} from '@/tools/components/tool-catalog/types'
import { findAttached } from '@/tools/components/tool-catalog/utils'

interface Props {
  agentId: string
  attached: AttachedToolViewType[]
  catalog: ToolCatalogEntryType[]
  connections: ConnectorConnectionViewType[]
}

export function ToolCatalog({
  agentId,
  catalog,
  attached,
  connections,
}: Props) {
  const attachedToolIds = new Set(attached.map((item) => item.toolId))
  const attachedEntries = catalog.filter((entry) =>
    attachedToolIds.has(entry.toolId)
  )
  const availableEntries = catalog.filter(
    (entry) => !attachedToolIds.has(entry.toolId)
  )

  return (
    <div className="flex flex-col gap-10">
      <ToolCatalogSection
        agentId={agentId}
        attached={attached}
        connections={connections}
        emptyText="No maintainer tools are attached to this agent yet."
        entries={attachedEntries}
        title="Attached tools"
      />
      <ToolCatalogSection
        agentId={agentId}
        attached={attached}
        connections={connections}
        emptyText="Every available maintainer tool is already attached."
        entries={availableEntries}
        title="Available tools"
      />
    </div>
  )
}

function ToolCatalogSection({
  agentId,
  attached,
  connections,
  emptyText,
  entries,
  title,
}: {
  agentId: string
  attached: AttachedToolViewType[]
  connections: ConnectorConnectionViewType[]
  emptyText: string
  entries: ToolCatalogEntryType[]
  title: string
}) {
  return (
    <section>
      <h2 className="swiss-label mb-4 text-accent">{title}</h2>
      {entries.length === 0 ? (
        <p className="border-foreground border-y-2 py-6 text-muted-foreground text-sm">
          {emptyText}
        </p>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
          {entries.map((entry) => (
            <li className="py-6" key={entry.toolId}>
              <ToolRow
                agentId={agentId}
                attached={findAttached(attached, entry.toolId)}
                connections={connections}
                entry={entry}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
