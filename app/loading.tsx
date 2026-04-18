import { AppShell } from "@/components/app-shell"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ConnectionNoticeSkeleton,
  DigestSkeleton,
  HeaderStatusSkeleton,
  SummarySkeleton,
} from "@/components/skeletons"

export default function DashboardLoading() {
  return (
    <AppShell>
      <header className="mb-12 flex flex-col gap-2 md:mb-16">
        <Skeleton className="h-3 w-48" />
        <div className="mt-2 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <Skeleton className="h-12 w-72 md:h-16" />
          <HeaderStatusSkeleton />
        </div>
      </header>
      <ConnectionNoticeSkeleton />
      <SummarySkeleton />
      <DigestSkeleton />
    </AppShell>
  )
}
