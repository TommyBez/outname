import { Button } from '@outname/ui/components/ui/button'
import { ConfirmActionDialog } from '@outname/ui/components/ui/confirm-action-dialog'
import type { ReactNode } from 'react'
import type { ToolCatalogBuildPhase } from './build-phase'

interface CatalogActionButtonsProps {
  buildPhase: ToolCatalogBuildPhase
  hasFields: boolean
  onAttach: () => void
  onDetach: () => Promise<void>
  onToggleOpen: () => void
  open: boolean
  pending: boolean
}

export function CatalogActionButtons({
  buildPhase,
  hasFields,
  onAttach,
  onDetach,
  onToggleOpen,
  open,
  pending,
}: CatalogActionButtonsProps) {
  const isAttached = buildPhase !== 'detached'
  const isPending =
    buildPhase === 'preparing' ||
    buildPhase === 'building' ||
    buildPhase === 'failed'
  const isFailedPending = buildPhase === 'failed'
  const isBuilding = buildPhase === 'building'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!(isAttached || hasFields) && (
        <PrimaryActionButton
          disabled={pending || isBuilding}
          onClick={onAttach}
        >
          {pending ? '...' : 'Attach'}
        </PrimaryActionButton>
      )}
      {!isAttached && hasFields && (
        <PrimaryActionButton disabled={isBuilding} onClick={onToggleOpen}>
          {open ? 'Cancel' : 'Attach'}
        </PrimaryActionButton>
      )}
      {isAttached && hasFields && (
        <SecondaryActionButton disabled={isBuilding} onClick={onToggleOpen}>
          {open ? 'Cancel' : 'Edit config'}
        </SecondaryActionButton>
      )}
      {isAttached && isFailedPending && (
        <PrimaryActionButton disabled={pending} onClick={onAttach}>
          {pending ? '...' : 'Retry'}
        </PrimaryActionButton>
      )}
      {isAttached && (
        <ConfirmActionDialog
          confirmLabel="Detach tool"
          description="Detaching removes this tool and its saved configuration from the agent. You can re-attach it later, but the configuration will need to be entered again."
          onConfirm={onDetach}
          title="Detach this tool?"
          trigger={
            <Button
              className="hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
              disabled={pending || isBuilding}
              size="sm"
              type="button"
              variant="outline"
            >
              {pending ? '...' : 'Detach'}
            </Button>
          }
        />
      )}
      {isAttached && !isPending && (
        <output className="inline-flex h-10 items-center border-2 border-foreground bg-foreground px-3 font-bold text-[10px] text-background uppercase tracking-[0.16em]">
          Attached
        </output>
      )}
      {isPending && (
        <output
          className={`inline-flex h-10 items-center border-2 px-3 font-bold text-[10px] uppercase tracking-[0.16em] ${
            isFailedPending
              ? 'border-destructive text-destructive'
              : 'border-foreground'
          }`}
        >
          {isFailedPending ? 'Build failed' : 'Preparing...'}
        </output>
      )}
    </div>
  )
}

function PrimaryActionButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button disabled={disabled} onClick={onClick} size="sm" type="button">
      {children}
    </Button>
  )
}

function SecondaryActionButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      size="sm"
      type="button"
      variant="outline"
    >
      {children}
    </Button>
  )
}
