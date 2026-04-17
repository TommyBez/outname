import { requireSession } from "@/lib/auth-guard"
import { AppShell } from "@/components/app-shell"
import { TriggerButton } from "@/components/trigger-button"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/categories"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await requireSession()

  return (
    <AppShell>
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Settings
        </p>
        <h1 className="mt-2 font-serif text-3xl font-medium">Agent configuration</h1>
      </div>

      <div className="flex flex-col gap-8">
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-serif text-xl font-medium">Schedule</h2>
          <div className="grid grid-cols-2 gap-6">
            <Field>
              <FieldLabel>Daily run (cron)</FieldLabel>
              <p className="font-mono text-sm">07:00 UTC · ~08:00 Europe/Rome</p>
              <FieldDescription>
                Configured in vercel.json. Edit the file and redeploy to change.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Manual trigger</FieldLabel>
              <TriggerButton variant="outline" />
              <FieldDescription>
                Runs the full daily review pipeline immediately.
              </FieldDescription>
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-serif text-xl font-medium">Pipeline</h2>
          <ol className="flex flex-col gap-4 text-sm">
            <PipelineStep n={1} title="Init run" detail="Record started in Neon with status: running." />
            <PipelineStep
              n={2}
              title="Read emails"
              detail="gws CLI executed inside a Vercel Sandbox using GOOGLE_WORKSPACE_CLI_TOKEN."
            />
            <PipelineStep
              n={3}
              title="Classify & summarize"
              detail="Specialist LLM categorizes each email into urgent / reply / fyi / noise."
            />
            <PipelineStep
              n={4}
              title="Persist digest"
              detail="Digest + items written to Neon."
            />
            <PipelineStep n={5} title="Finalize run" detail="Mark run completed or failed." />
          </ol>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-serif text-xl font-medium">Categories</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CATEGORY_ORDER.map((cat) => {
              const meta = CATEGORY_META[cat]
              const Icon = meta.icon
              return (
                <li key={cat} className="flex items-start gap-3 rounded-md border border-border p-3">
                  <div className={`flex size-8 items-center justify-center rounded-md border ${meta.chip}`}>
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="font-medium">{meta.label}</p>
                    <p className="text-sm text-muted-foreground">{meta.description}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-serif text-xl font-medium">Account</h2>
          <Field>
            <FieldLabel>Signed in as</FieldLabel>
            <p className="font-mono text-sm">{session.user.email}</p>
          </Field>
        </section>
      </div>
    </AppShell>
  )
}

function PipelineStep({ n, title, detail }: { n: number; title: string; detail: string }) {
  return (
    <li className="grid grid-cols-[auto_1fr] items-start gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-xs">
        {n}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </li>
  )
}
