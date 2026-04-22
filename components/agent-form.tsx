"use client"

import { Button } from "@/components/ui/button"
import type { AgentKindDefinition } from "@/workflows/agents/registry"
import type { Agent } from "@/lib/db/schema"

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
  const initialEnabled = props.mode === "create" ? true : props.agent.enabled

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
            Disabled agents can still be triggered manually, but will not
            appear in day-to-day summaries.
          </p>
        </Section>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="submit" size="sm" className="w-full sm:w-auto">
          {props.mode === "create" ? "Create agent" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[160px_1fr] lg:gap-10">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  )
}
