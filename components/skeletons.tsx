import { Skeleton } from "@/components/ui/skeleton"

export function SummarySkeleton() {
  return (
    <section className="mb-14 grid grid-cols-1 gap-10 border-y border-border py-8 md:grid-cols-[auto_1fr] md:gap-16 md:py-10">
      <div>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-4 h-16 w-24 md:h-20" />
        <Skeleton className="mt-4 h-3 w-20" />
      </div>
      <dl className="grid grid-cols-2 gap-x-10 gap-y-6 self-end sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-10" />
          </div>
        ))}
      </dl>
    </section>
  )
}

export function DigestSkeleton() {
  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-full max-w-2xl" />
        <Skeleton className="h-6 w-3/4 max-w-xl" />
      </div>
      {Array.from({ length: 2 }).map((_, s) => (
        <section key={s}>
          <div className="mb-6 flex items-baseline gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-6" />
          </div>
          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="py-6 first:pt-6">
                <div className="mb-2 flex items-baseline justify-between gap-4">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-5 w-5/6" />
                <Skeleton className="mt-3 h-4 w-full max-w-md" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function RunListSkeleton() {
  return (
    <ul className="flex flex-col divide-y divide-border border-y border-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="grid grid-cols-[1fr_auto] items-baseline gap-6 py-5 md:grid-cols-[1fr_auto_auto] md:gap-10">
          <div className="flex flex-col gap-2 min-w-0">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="hidden h-4 w-4 md:block" />
        </li>
      ))}
    </ul>
  )
}

export function ConnectionNoticeSkeleton() {
  return (
    <div className="mb-12 border-y border-border py-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-2 h-6 w-full max-w-md" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>
    </div>
  )
}

export function GmailSectionSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-6 w-48" />
        <Skeleton className="mt-2 h-3 w-32" />
      </div>
      <Skeleton className="h-4 w-24" />
    </div>
  )
}

export function HeaderStatusSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-24" />
    </div>
  )
}

export function AccountSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-64" />
    </div>
  )
}
