"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { CheckCircle2, AlertTriangle, Link2, Unlink } from "lucide-react"

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
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 rounded-md border border-dashed border-border p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--color-accent)]" />
          <div>
            <p className="font-medium">Gmail is not connected</p>
            <p className="text-sm text-muted-foreground">
              Connect your Google account so the agent can read your inbox. Read-only access only.
            </p>
          </div>
        </div>
        <div>
          <Button asChild>
            <a href="/api/google/connect">
              <Link2 className="mr-2 size-4" />
              Connect Gmail
            </a>
          </Button>
        </div>
      </div>
    )
  }

  const expired = connection.status !== "active"

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`flex items-start gap-3 rounded-md border p-4 ${
          expired
            ? "border-destructive/40 bg-destructive/5"
            : "border-border bg-[var(--color-muted)]/40"
        }`}
      >
        {expired ? (
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--color-success)]" />
        )}
        <div className="flex-1">
          <p className="font-medium">
            {expired ? "Gmail connection needs attention" : "Connected"}
          </p>
          <p className="mt-0.5 font-mono text-sm">{connection.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Connected {new Date(connection.connectedAt).toLocaleDateString()} · Status:{" "}
            <span className={expired ? "text-destructive" : ""}>{connection.status}</span>
          </p>
          {expired && connection.lastError ? (
            <p className="mt-2 rounded bg-background/60 p-2 font-mono text-xs text-muted-foreground">
              {connection.lastError}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2">
        {expired ? (
          <Button asChild>
            <a href="/api/google/connect">
              <Link2 className="mr-2 size-4" />
              Reconnect Gmail
            </a>
          </Button>
        ) : null}
        <Button variant="outline" onClick={disconnect} disabled={busy}>
          {busy ? <Spinner className="mr-2 size-4" /> : <Unlink className="mr-2 size-4" />}
          Disconnect
        </Button>
      </div>
    </div>
  )
}
