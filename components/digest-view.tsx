import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Inbox } from "lucide-react"
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/categories"
import type { Category, DigestItem } from "@/lib/db/schema"
import { formatRelative, parseSender } from "@/lib/format"
import { cn } from "@/lib/utils"

export function DigestView({
  items,
  summary,
}: {
  items: DigestItem[]
  summary: string | null
}) {
  if (items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <Inbox className="size-10 text-muted-foreground" />
          <EmptyTitle>No new emails</EmptyTitle>
          <EmptyDescription>
            {summary ?? "Your inbox has been quiet since the last run."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category === cat),
  }))

  return (
    <div className="flex flex-col gap-8">
      {summary && (
        <blockquote className="border-l-2 border-accent pl-4 font-serif text-lg italic leading-relaxed text-foreground text-pretty">
          {summary}
        </blockquote>
      )}

      <CategorySummary items={items} />

      <div className="flex flex-col gap-10">
        {grouped.map((group) =>
          group.items.length === 0 ? null : (
            <CategorySection
              key={group.category}
              category={group.category}
              items={group.items}
            />
          ),
        )}
      </div>
    </div>
  )
}

function CategorySummary({ items }: { items: DigestItem[] }) {
  const counts = CATEGORY_ORDER.map((cat) => ({
    cat,
    n: items.filter((i) => i.category === cat).length,
  }))
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {counts.map(({ cat, n }) => {
        const meta = CATEGORY_META[cat]
        const Icon = meta.icon
        return (
          <div
            key={cat}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-md",
                meta.chip,
                "border",
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {meta.label}
              </span>
              <span className="font-serif text-2xl font-medium leading-none">{n}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CategorySection({
  category,
  items,
}: {
  category: Category
  items: DigestItem[]
}) {
  const meta = CATEGORY_META[category]
  const Icon = meta.icon
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <h2 className="font-serif text-xl font-medium">{meta.label}</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {items.length}
          </span>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {meta.description}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <DigestItemRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  )
}

function DigestItemRow({ item }: { item: DigestItem }) {
  const sender = parseSender(item.sender)
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-4 py-4">
      <span
        className={cn(
          "mt-1.5 inline-block size-2 shrink-0 rounded-full",
          CATEGORY_META[item.category as Category].dot,
        )}
        aria-hidden
      />
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="truncate font-medium text-foreground">{sender.name}</span>
          <span className="hidden truncate font-mono text-xs text-muted-foreground sm:inline">
            {sender.email}
          </span>
        </div>
        <h3 className="text-pretty text-base font-medium leading-snug">
          {item.subject || "(no subject)"}
        </h3>
        {item.summary && (
          <p className="text-pretty text-sm text-muted-foreground leading-relaxed">
            {item.summary}
          </p>
        )}
      </div>
      <time className="whitespace-nowrap font-mono text-xs text-muted-foreground">
        {formatRelative(item.receivedAt)}
      </time>
    </li>
  )
}
