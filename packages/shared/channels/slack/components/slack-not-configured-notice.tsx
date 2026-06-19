export function SlackNotConfiguredNotice() {
  return (
    <p className="border border-border bg-muted px-4 py-3 text-sm">
      Slack is not configured on this deployment. Set{' '}
      <code className="font-mono">SLACK_CLIENT_ID</code>,{' '}
      <code className="font-mono">SLACK_CLIENT_SECRET</code>, and{' '}
      <code className="font-mono">SLACK_SIGNING_SECRET</code>, then redeploy.
    </p>
  )
}
