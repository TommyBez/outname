import { AlertTriangle, MessageSquareReply, Info, EyeOff } from "lucide-react"
import type { Category } from "@/lib/db/schema"

export const CATEGORY_ORDER: Category[] = ["urgent", "reply", "fyi", "noise"]

export const CATEGORY_META: Record<
  Category,
  { label: string; description: string; icon: typeof AlertTriangle; dot: string; chip: string }
> = {
  urgent: {
    label: "Urgent",
    description: "Time-sensitive. Action needed soon.",
    icon: AlertTriangle,
    dot: "bg-destructive",
    chip: "bg-destructive/10 text-destructive border-destructive/20",
  },
  reply: {
    label: "Needs reply",
    description: "Personal responses expected.",
    icon: MessageSquareReply,
    dot: "bg-accent",
    chip: "bg-accent/15 text-accent-foreground border-accent/30",
  },
  fyi: {
    label: "FYI",
    description: "Informational, no action required.",
    icon: Info,
    dot: "bg-chart-3",
    chip: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  },
  noise: {
    label: "Noise",
    description: "Newsletters, promotions, automated.",
    icon: EyeOff,
    dot: "bg-muted-foreground",
    chip: "bg-muted text-muted-foreground border-border",
  },
}
