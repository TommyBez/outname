import { AppShell } from "@/components/app-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { RunListSkeleton } from "@/components/skeletons"

export default function RunsLoading() {
  return (
    <AppShell>
      <header className="mb-10 flex flex-col gap-2 md:mb-14">
        <Skeleton className="h-3 w-20" />
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <Skeleton className="h-10 w-48 md:h-12" />
          <Skeleton className="h-9 w-28" />
        </div>
      </header>
      <RunListSkeleton />
    </AppShell>
  )
}
