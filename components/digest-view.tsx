import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/categories"
import type { Category, DigestItem } from "@/lib/db/schema"
import { formatTime, parseSender } from "@/lib/format"

export function DigestView({
  items,
  summary,
}: {
  items: DigestItem[]
  summary: string | null
}) {
  if (items.length === 0) {
    return (
      <div className="border-t border-border pt-10">
        <p className="font-serif text-2xl leading-snug text-pretty">
          {summary ?? "Your inbox has been quiet since the last run."}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">No new emails worth surfacing.</p>
      </div>
    )
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="flex flex-col gap-14">
      {summary && (
        <p className="font-serif text-xl leading-relaxed text-pretty text-foreground md:text-2xl">
          {summary}
        </p>
      )}

      {grouped.map((group) => (
        <CategorySection key={group.category} category={group.category} items={group.items} />
      ))}
    </div>
  )
}

function CategorySection({ category, items }: { category: Category; items: DigestItem[] }) {
  const meta = CATEGORY_META[category]
  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className={`font-mono text-xs uppercase tracking-[0.2em] ${meta.tone}`}>
            {meta.label}
          </h2>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {items.length.toString().padStart(2, "0")}
          </span>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">{meta.description}</p>
      </div>
      <ul className="flex flex-col divide-y divide-border border-t border-border">
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
    <li className="py-6 first:pt-6 last:pb-0">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="truncate font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {sender.name}
        </span>
        <time className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
          {formatTime(item.receivedAt)}
        </time>
      </div>
      <h3 className="font-serif text-lg font-medium leading-snug text-pretty text-foreground">
        {item.subject || "(no subject)"}
      </h3>
      {item.summary && (
        <p className="mt-2 text-pretty text-[15px] leading-relaxed text-muted-foreground">
          {item.summary}
        </p>
      )}
    </li>
  )
}
