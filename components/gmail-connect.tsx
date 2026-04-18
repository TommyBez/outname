"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

interface Props {
  connection: {
    email: string
    status: string
    scopes: string
    connectedAt: string
    lastError: string | null
  } | null
}

export function GmailConnect({ connection }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function disconnect() {
    if (!confirm("Disconnect Gmail? Daily runs will stop until you reconnect.")) return
    setBusy(true)
    try {
      const res = await fetch("/api/google/disconnect", { method: "POST" })
      if (!res.ok) throw new Error("Failed to disconnect")
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to disconnect")
    } finally {
      setBusy(false)
    }
  }

  if (!connection) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Not connected
          </p>
          <p className="mt-2 font-serif text-lg leading-snug">
            The agent needs read-only access to your inbox.
          </p>
        </div>
        <div>
          <Button asChild>
            <a href="/api/google/connect">Connect Gmail</a>
          </Button>
        </div>
      </div>
    )
  }

  const expired = connection.status !== "active"

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`inline-block size-1.5 rounded-full ${expired ? "bg-destructive" : "bg-foreground/60"}`}
          />
          <p className={`font-mono text-xs uppercase tracking-[0.2em] ${expired ? "text-destructive" : "text-muted-foreground"}`}>
            {expired ? "Needs attention" : "Connected"}
          </p>
        </div>
        <p className="mt-2 font-serif text-lg font-medium leading-snug">{connection.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Linked {new Date(connection.connectedAt).toLocaleDateString()}
        </p>
        {expired && connection.lastError ? (
          <pre className="mt-3 max-h-32 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
            {connection.lastError}
          </pre>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {expired ? (
          <Button asChild size="sm">
            <a href="/api/google/connect">Reconnect</a>
          </Button>
        ) : null}
        <button
          type="button"
          onClick={disconnect}
          disabled={busy}
          className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-3.5" />
              Disconnecting…
            </span>
          ) : (
            "Disconnect"
          )}
        </button>
      </div>
    </div>
  )
}
