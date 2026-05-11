'use client'

import { ToolRow } from '@/tools/components/tool-catalog/tool-row'
import type {
  AttachedToolView as AttachedToolViewType,
  ProviderConnectionView as ProviderConnectionViewType,
  ToolCatalogEntry as ToolCatalogEntryType,
} from '@/tools/components/tool-catalog/types'
import { findAttached } from '@/tools/components/tool-catalog/utils'

interface Props {
  agentId: string
  attached: AttachedToolViewType[]
  catalog: ToolCatalogEntryType[]
  connections: ProviderConnectionViewType[]
}

export function ToolCatalog({
  agentId,
  catalog,
  attached,
  connections,
}: Props) {
  return (
    <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
      {catalog.map((entry) => (
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
  )
}
