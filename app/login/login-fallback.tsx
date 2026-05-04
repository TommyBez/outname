import { Skeleton } from '@/components/ui/skeleton'

export function LoginFallback() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="mx-auto h-4 w-40" />
    </div>
  )
}
