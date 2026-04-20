"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { updateUserTimezoneAction } from "@/lib/agent-actions"

const FALLBACK_ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
]

/**
 * Server action wrapper so we can toast after success.
 */
export function TimezonePicker({ current }: { current: string }) {
  const [value, setValue] = useState(current)
  const [detected, setDetected] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    try {
      setDetected(Intl.DateTimeFormat().resolvedOptions().timeZone)
    } catch {
      /* ignore */
    }
  }, [])

  const zones = useMemo(() => {
    // Modern browsers expose Intl.supportedValuesOf("timeZone"). Fall back
    // to a curated list when not available.
    const api = (Intl as unknown as {
      supportedValuesOf?: (k: string) => string[]
    }).supportedValuesOf
    if (typeof api === "function") {
      try {
        return api("timeZone")
      } catch {
        /* ignore */
      }
    }
    return FALLBACK_ZONES
  }, [])

  async function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateUserTimezoneAction(formData)
        toast.success("Timezone updated")
      } catch (err) {
        toast.error("Could not update timezone", {
          description: err instanceof Error ? err.message : "Unknown error",
        })
      }
    })
  }

  return (
    <form action={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          name="timezone"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-foreground"
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={pending || value === current}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {detected && detected !== current && (
        <button
          type="button"
          onClick={() => setValue(detected)}
          className="self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Use detected: <span className="font-mono">{detected}</span>
        </button>
      )}
      <p className="text-xs text-muted-foreground">
        All agent schedules are interpreted in this timezone.
      </p>
    </form>
  )
}
