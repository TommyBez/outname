import type { Category } from "@/lib/db/schema"

export const CATEGORY_ORDER: Category[] = ["urgent", "reply", "fyi", "noise"]

export const CATEGORY_META: Record<
  Category,
  { label: string; shortLabel: string; description: string; tone: string; rule: string }
> = {
  urgent: {
    label: "Urgent",
    shortLabel: "Urgent",
    description: "Time-sensitive. Action needed soon.",
    tone: "text-destructive",
    rule: "bg-destructive",
  },
  reply: {
    label: "Needs a reply",
    shortLabel: "To reply",
    description: "Personal responses expected.",
    tone: "text-foreground",
    rule: "bg-foreground",
  },
  fyi: {
    label: "For your information",
    shortLabel: "FYI",
    description: "Informational, no action required.",
    tone: "text-muted-foreground",
    rule: "bg-muted-foreground/60",
  },
  noise: {
    label: "Noise",
    shortLabel: "Noise",
    description: "Newsletters, promotions, automated.",
    tone: "text-muted-foreground",
    rule: "bg-muted-foreground/30",
  },
}
