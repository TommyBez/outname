import { AppShell } from "@/components/app-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { DigestSkeleton } from "@/components/skeletons"

export default function RunDetailLoading() {
  return (
    <AppShell>
      <Skeleton className="mb-10 h-4 w-24" />
      <header className="mb-12 flex flex-col gap-4 md:mb-16">
        <Skeleton className="h-3 w-28" />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3 w-40" />
      </header>
      <DigestSkeleton />
    </AppShell>
  )
}
