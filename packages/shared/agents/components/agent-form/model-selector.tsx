import type { ModelOption } from '@outname/shared/server/ai-gateway-models'
import { Button } from '@outname/ui/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@outname/ui/components/ui/command'
import { Label } from '@outname/ui/components/ui/label'
import { cn } from '@outname/ui/lib/utils'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  groupModelsByProvider,
  modelMatchesSearch,
  resolveModelOptions,
  selectedModelSort,
  uniqueModelsById,
} from './options'

export function ModelSelector({
  defaultModel,
  model,
  models,
  setModel,
}: {
  defaultModel: string
  model: string
  models: ModelOption[]
  setModel: (value: string) => void
}) {
  const [modelDialogOpen, setModelDialogOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const availableModels = uniqueModelsById(
    resolveModelOptions(models, defaultModel)
  )
  const selectedModel =
    availableModels.find((option) => option.id === model) ?? availableModels[0]
  const sortedModels = useMemo(
    () => availableModels.toSorted(selectedModelSort(model)),
    [availableModels, model]
  )
  const visibleModels = useMemo(
    () =>
      sortedModels.filter((option) => modelMatchesSearch(option, modelSearch)),
    [sortedModels, modelSearch]
  )
  const { grouped, ownedByKeys } = groupModelsByProvider(
    visibleModels,
    selectedModel?.ownedBy
  )

  return (
    <div className="grid gap-3 border-foreground border-b-2 pb-8 md:grid-cols-[12rem_minmax(0,1fr)]">
      <Label htmlFor="agent-model">Model</Label>
      <div className="flex flex-col gap-2">
        <Button
          aria-expanded={modelDialogOpen}
          aria-haspopup="dialog"
          className="h-auto min-h-11 w-full justify-between gap-4 whitespace-normal px-3 py-2 text-left normal-case tracking-normal"
          id="agent-model"
          onClick={() => {
            setModelSearch('')
            setModelDialogOpen(true)
          }}
          type="button"
          variant="outline"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium text-sm">
              {selectedModel?.name ?? 'Select a model'}
            </span>
            {selectedModel ? (
              <span className="truncate text-muted-foreground text-xs">
                {selectedModel.id}
              </span>
            ) : null}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
        <CommandDialog
          className="border-2 border-foreground sm:max-w-2xl"
          commandProps={{ shouldFilter: false }}
          description="Search models by name, id, or provider."
          onOpenChange={(open) => {
            setModelDialogOpen(open)
            if (!open) {
              setModelSearch('')
            }
          }}
          open={modelDialogOpen}
          showHeader
          title="Select model"
        >
          <CommandInput
            onValueChange={setModelSearch}
            placeholder="Search models..."
            value={modelSearch}
          />
          <CommandList className="max-h-[60vh] pr-1">
            <CommandEmpty>No models found.</CommandEmpty>
            {ownedByKeys.map((ownedBy) => (
              <CommandGroup heading={ownedBy} key={ownedBy} value={ownedBy}>
                {grouped[ownedBy].map((option) => (
                  <ModelCommandItem
                    isSelected={model === option.id}
                    key={option.id}
                    onSelect={(selectedId) => {
                      setModel(selectedId)
                      setModelDialogOpen(false)
                    }}
                    option={option}
                  />
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </CommandDialog>
        <p className="text-muted-foreground text-xs">
          Routed through the Vercel AI Gateway. Filtered to models that support
          tool calling.
        </p>
      </div>
    </div>
  )
}

function ModelCommandItem({
  isSelected,
  onSelect,
  option,
}: {
  isSelected: boolean
  onSelect: (selectedId: string) => void
  option: ModelOption
}) {
  return (
    <CommandItem
      className="data-[selected=true]:[&_span]:text-accent-foreground data-[selected=true]:[&_svg]:text-accent-foreground"
      onSelect={onSelect}
      value={option.id}
    >
      <CheckIcon
        className={cn(
          'size-4 text-current',
          isSelected ? 'opacity-100' : 'opacity-0'
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{option.name}</span>
        <span className="truncate text-muted-foreground text-xs">
          {option.id}
        </span>
      </span>
      <span className="shrink-0 border border-border px-1.5 py-0.5 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
        {option.ownedBy}
      </span>
      {isSelected ? (
        <span className="shrink-0 border border-current px-1.5 py-0.5 font-bold text-[10px] uppercase tracking-[0.14em]">
          Current
        </span>
      ) : null}
      {option.contextWindow > 0 ? (
        <span className="mr-2 shrink-0 text-muted-foreground text-xs">
          {(option.contextWindow / 1000).toFixed(0)}k ctx
        </span>
      ) : null}
    </CommandItem>
  )
}
