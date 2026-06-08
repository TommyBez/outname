import { Label } from '@outname/ui/components/ui/label'
import { Switch } from '@outname/ui/components/ui/switch'

export function DreamingSettings({
  dreamingEnabled,
  setDreamingEnabled,
}: {
  dreamingEnabled: boolean
  setDreamingEnabled: (value: boolean) => void
}) {
  return (
    <div className="grid gap-4 border-2 border-foreground bg-background p-5 md:grid-cols-[12rem_minmax(0,1fr)]">
      <Label
        className="font-bold text-sm uppercase tracking-[0.14em]"
        htmlFor="agent-dreaming"
      >
        Dreaming
      </Label>
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-xs">
          When on, the runtime consolidates recent evidence into DreamingStore,
          MEMORY.md, and the cumulative Dream Diary once per local day.
        </p>
        <Switch
          checked={dreamingEnabled}
          id="agent-dreaming"
          onCheckedChange={setDreamingEnabled}
        />
      </div>
    </div>
  )
}
