import { Skeleton } from '@/components/ui/skeleton'

const SUMMARY_CELL_KEYS = ['sk-0', 'sk-1', 'sk-2', 'sk-3'] as const
const RESULT_SECTION_KEYS = ['sec-0', 'sec-1'] as const
const RESULT_LINE_KEYS = ['ln-0', 'ln-1', 'ln-2'] as const
const RUN_LIST_ROW_KEYS = ['row-0', 'row-1', 'row-2', 'row-3', 'row-4'] as const

export function SummarySkeleton() {
  return (
    <section className="mb-14 grid grid-cols-1 gap-10 border-border border-y py-8 md:grid-cols-[auto_1fr] md:gap-16 md:py-10">
      <div>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-4 h-16 w-24 md:h-20" />
        <Skeleton className="mt-4 h-3 w-20" />
      </div>
      <dl className="grid grid-cols-2 gap-x-10 gap-y-6 self-end sm:grid-cols-4">
        {SUMMARY_CELL_KEYS.map((key) => (
          <div className="flex flex-col gap-2" key={key}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-10" />
          </div>
        ))}
      </dl>
    </section>
  )
}

export function RunResultSkeleton() {
  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-full max-w-2xl" />
        <Skeleton className="h-6 w-3/4 max-w-xl" />
      </div>
      {RESULT_SECTION_KEYS.map((sectionKey) => (
        <section key={sectionKey}>
          <div className="mb-6 flex items-baseline gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-6" />
          </div>
          <ul className="flex flex-col divide-y divide-border border-border border-t">
            {RESULT_LINE_KEYS.map((lineKey) => (
              <li className="py-6 first:pt-6" key={`${sectionKey}-${lineKey}`}>
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
    <ul className="flex flex-col divide-y divide-border border-border border-y">
      {RUN_LIST_ROW_KEYS.map((key) => (
        <li
          className="grid grid-cols-[1fr_auto] items-baseline gap-6 py-5 md:grid-cols-[1fr_auto_auto] md:gap-10"
          key={key}
        >
          <div className="flex min-w-0 flex-col gap-2">
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
    <div className="mb-12 border-border border-y py-5">
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

export function ConnectionsSectionSkeleton() {
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

export function AgentCardSkeleton() {
  return (
    <div className="flex flex-col gap-5 py-10 first:pt-0 last:pb-0 md:px-2">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28 rounded-sm" />
        <Skeleton className="h-10 w-56 rounded-sm" />
        <Skeleton className="h-3 w-32 rounded-sm" />
      </div>
      <div className="flex items-center justify-between gap-6 border-border border-t pt-5">
        <Skeleton className="h-4 w-48 rounded-sm" />
        <Skeleton className="h-4 w-16 rounded-sm" />
      </div>
    </div>
  )
}
