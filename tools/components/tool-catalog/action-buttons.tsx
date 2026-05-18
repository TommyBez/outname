import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface CatalogActionButtonsProps {
  hasFields: boolean
  isAttached: boolean
  isBuilding: boolean
  isFailedPending: boolean
  isPending: boolean
  onAttach: () => void
  onDetach: () => void
  onToggleOpen: () => void
  open: boolean
  pending: boolean
}

export function CatalogActionButtons({
  hasFields,
  isAttached,
  isBuilding,
  isFailedPending,
  isPending,
  onAttach,
  onDetach,
  onToggleOpen,
  open,
  pending,
}: CatalogActionButtonsProps) {
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
        <Button
          className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
          disabled={pending || isBuilding}
          onClick={onDetach}
          type="button"
        >
          {pending ? '...' : 'Detach'}
        </Button>
      )}
      {isAttached && !isPending && (
        <span
          className="inline-flex h-10 items-center border-2 border-foreground bg-foreground px-3 font-bold text-[10px] text-background uppercase tracking-[0.16em]"
          role="status"
        >
          Attached
        </span>
      )}
      {isPending && (
        <span
          className={`inline-flex h-10 items-center border-2 px-3 font-bold text-[10px] uppercase tracking-[0.16em] ${
            isFailedPending
              ? 'border-destructive text-destructive'
              : 'border-foreground'
          }`}
          role="status"
        >
          {isFailedPending ? 'Build failed' : 'Preparing...'}
        </span>
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
    <Button
      className="inline-flex h-10 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
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
      className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </Button>
  )
}
