"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { AgentKindDefinition } from "@/workflows/agents/registry"
import type { Agent } from "@/lib/db/schema"

const DAY_OPTIONS = [
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
  { value: 7, short: "Sun" },
]

interface CreateProps {
  mode: "create"
  kinds: AgentKindDefinition[]
  action: (formData: FormData) => void | Promise<void>
}

interface EditProps {
  mode: "edit"
  agent: Agent
  kindLabel: string
  action: (formData: FormData) => void | Promise<void>
}

export function AgentForm(props: CreateProps | EditProps) {
  const initialKind =
    props.mode === "create" ? props.kinds[0]?.kind ?? "daily-email-brief" : props.agent.kind
  const initialName =
    props.mode === "create"
      ? props.kinds[0]?.defaultName ?? ""
      : props.agent.name
  const initialTime =
    props.mode === "create"
      ? props.kinds[0]?.defaultScheduleTime ?? "08:00"
      : props.agent.scheduleTime
  const initialDays =
    props.mode === "create"
      ? props.kinds[0]?.defaultScheduleDays ?? [1, 2, 3, 4, 5]
      : props.agent.scheduleDays
  const initialEnabled = props.mode === "create" ? true : props.agent.enabled

  const [days, setDays] = useState<number[]>(initialDays)

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    )
  }

  return (
    <form action={props.action} className="flex flex-col gap-10">
      {props.mode === "create" && (
        <Section label="Kind">
          <div className="flex flex-col gap-3">
            {props.kinds.map((k) => (
              <label
                key={k.kind}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 transition-colors has-[:checked]:border-foreground"
              >
                <input
                  type="radio"
                  name="kind"
                  value={k.kind}
                  defaultChecked={k.kind === initialKind}
                  className="mt-1"
                />
                <div>
                  <p className="font-serif text-lg font-medium">{k.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {k.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </Section>
      )}

      {props.mode === "edit" && (
        <input type="hidden" name="kind" value={props.agent.kind} />
      )}

      <Section label="Name">
        <input
          type="text"
          name="name"
          required
          defaultValue={initialName}
          placeholder="Daily email brief"
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-serif text-lg outline-none transition-colors focus:border-foreground"
        />
      </Section>

      <Section label="Time">
        <input
          type="time"
          name="scheduleTime"
          required
          defaultValue={initialTime}
          className="rounded-md border border-border bg-background px-3 py-2 font-mono text-base outline-none transition-colors focus:border-foreground"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Interpreted in your timezone (change it in Settings).
        </p>
      </Section>

      <Section label="Days">
        <div className="flex flex-wrap gap-2">
          {DAY_OPTIONS.map((d) => {
            const checked = days.includes(d.value)
            return (
              <label
                key={d.value}
                className={`cursor-pointer select-none rounded-md border px-3 py-2 font-mono text-sm uppercase tracking-wider transition-colors ${
                  checked
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  name="scheduleDays"
                  value={d.value}
                  checked={checked}
                  onChange={() => toggleDay(d.value)}
                  className="sr-only"
                />
                {d.short}
              </label>
            )
          })}
        </div>
      </Section>

      {props.mode === "edit" && (
        <Section label="Status">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={initialEnabled}
              className="size-4"
            />
            <span className="font-serif text-lg">Enabled</span>
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Disabled agents are skipped by the daily scheduler but can still be
            triggered manually.
          </p>
        </Section>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" size="sm">
          {props.mode === "create" ? "Create agent" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr] md:gap-12">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </h2>
      <div>{children}</div>
    </section>
  )
}
