export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const sec = Math.round(diffMs / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)
  if (sec < 60) return "just now"
  if (min < 60) return `${min}m ago`
  if (hr < 24) return `${hr}h ago`
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function parseSender(raw: string | null): { name: string; email: string } {
  if (!raw) return { name: "Unknown", email: "" }
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (match) return { name: match[1].trim() || match[2], email: match[2] }
  return { name: raw.trim(), email: raw.trim() }
}
