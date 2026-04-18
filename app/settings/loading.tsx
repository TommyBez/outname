import { AppShell } from "@/components/app-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { AccountSkeleton, GmailSectionSkeleton } from "@/components/skeletons"

export default function SettingsLoading() {
  return (
    <AppShell>
      <header className="mb-12 flex flex-col gap-2 md:mb-16">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-10 w-64 md:h-12" />
      </header>
      <div className="flex flex-col divide-y divide-border">
        <Section title="Gmail">
          <GmailSectionSkeleton />
        </Section>
        <Section title="Schedule">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        </Section>
        <Section title="Account">
          <AccountSkeleton />
        </Section>
      </div>
    </AppShell>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-6 py-10 first:pt-0 last:pb-0 md:grid-cols-[180px_1fr] md:gap-12">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  )
}
