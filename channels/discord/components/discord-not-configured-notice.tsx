export function DiscordNotConfiguredNotice() {
  return (
    <p className="border-2 border-foreground bg-muted px-4 py-3 text-sm">
      Discord is not configured on this deployment. Set{' '}
      <code className="font-mono">DISCORD_APPLICATION_ID</code>,{' '}
      <code className="font-mono">DISCORD_BOT_TOKEN</code>,{' '}
      <code className="font-mono">DISCORD_PUBLIC_KEY</code>, and{' '}
      <code className="font-mono">DISCORD_CLIENT_SECRET</code>, then redeploy.
    </p>
  )
}
