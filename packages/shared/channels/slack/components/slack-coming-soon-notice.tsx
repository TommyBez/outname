export function SlackComingSoonNotice() {
  return (
    <div className="border border-border bg-muted px-4 py-3">
      <p className="mb-2 inline-flex h-7 items-center border border-border bg-background px-3 font-bold text-[10px] uppercase tracking-[0.16em]">
        Coming soon
      </p>
      <p className="text-muted-foreground text-sm">
        Slack workspace installs and agent bindings are not available for your
        account yet. Check back here when the integration opens.
      </p>
    </div>
  )
}
