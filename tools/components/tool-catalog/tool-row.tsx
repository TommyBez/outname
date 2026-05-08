import { AttachmentForm } from './attachment-form'
import { PendingBuildStrip } from './pending-build-strip'
import { ProviderChip } from './provider-chip'
import type {
  AttachedToolView,
  ProviderConnectionView,
  ToolCatalogEntry,
} from './types'
import { findConnection } from './utils'

export function ToolRow({
  agentId,
  entry,
  attached,
  connections,
}: {
  agentId: string
  entry: ToolCatalogEntry
  attached: AttachedToolView | null
  connections: ProviderConnectionView[]
}) {
  const isAttached = attached !== null
  const isPending = attached?.status === 'pending'
  const isBuilding = Boolean(isPending && attached?.pendingBuildId)
  const isFailedPending = Boolean(
    isPending && !attached?.pendingBuildId && attached?.toolSandboxError
  )
  const providerStates = entry.providers.map((provider) => {
    const connection = findConnection(connections, provider)
    return {
      provider,
      status: connection?.status ?? null,
      displayName: connection?.displayName ?? provider,
    }
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0">
          <p className="font-black font-mono text-sm uppercase tracking-[0.04em]">
            {entry.toolId}
          </p>
          <p className="mt-1 font-black font-serif text-xl uppercase tracking-[-0.04em]">
            {entry.displayName}
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            {entry.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {providerStates.length === 0 &&
              entry.toolSandboxManifest === null && (
                <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                  No connection required
                </span>
              )}
            {entry.toolSandboxManifest !== null && (
              <span className="inline-flex h-7 items-center border-2 border-foreground px-3 font-bold text-[10px] uppercase tracking-[0.16em]">
                Sandbox: {entry.toolSandboxManifest}
              </span>
            )}
            {providerStates.map((provider) => (
              <ProviderChip key={provider.provider} provider={provider} />
            ))}
          </div>
        </div>
      </div>
      {isPending && attached?.pendingBuildId && (
        <PendingBuildStrip buildId={attached.pendingBuildId} />
      )}
      {attached?.toolSandboxError && (
        <p
          className="border-2 border-destructive bg-destructive/5 px-3 py-2 font-mono text-destructive text-xs"
          role="alert"
        >
          Last build failed: {attached.toolSandboxError}
        </p>
      )}
      <AttachmentForm
        agentId={agentId}
        attached={attached}
        entry={entry}
        isAttached={isAttached}
        isBuilding={isBuilding}
        isFailedPending={isFailedPending}
        isPending={isPending}
      />
    </div>
  )
}
