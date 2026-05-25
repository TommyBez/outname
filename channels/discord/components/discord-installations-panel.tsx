'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { disconnectDiscordGuildAction } from '@/channels/discord/server/actions'
import type { DiscordGuildInstallationView } from '@/channels/discord/server/bindings-query'
import { DiscordNotConfiguredNotice } from './discord-not-configured-notice'

export function DiscordInstallationsPanel({
  guilds,
  isConfigured,
}: {
  guilds: DiscordGuildInstallationView[]
  isConfigured: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pendingGuildId, setPendingGuildId] = useState<string | null>(null)

  function disconnect(guildId: string) {
    setPendingGuildId(guildId)
    startTransition(async () => {
      const result = await disconnectDiscordGuildAction({ guildId })
      setPendingGuildId(null)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not disconnect Discord server.')
        return
      }
      toast.success('Discord server disconnected.')
      router.refresh()
    })
  }

  if (!isConfigured) {
    return <DiscordNotConfiguredNotice />
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-bold text-xs uppercase tracking-[0.16em]">
        Installed servers
      </p>
      {guilds.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Discord servers installed yet for your account.
        </p>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
          {guilds.map((guild) => (
            <li
              className="flex items-center justify-between gap-3 py-3"
              key={guild.guildId}
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-sm">
                  {guild.guildName ?? guild.guildId}
                </p>
                <p className="truncate font-mono text-muted-foreground text-xs">
                  guild:{guild.guildId}
                </p>
              </div>
              <button
                className="inline-flex h-9 items-center justify-center border-2 border-foreground px-3 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background disabled:opacity-50"
                disabled={pending && pendingGuildId === guild.guildId}
                onClick={() => disconnect(guild.guildId)}
                type="button"
              >
                {pending && pendingGuildId === guild.guildId
                  ? '...'
                  : 'Disconnect'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <a
        className="inline-flex h-10 w-fit items-center gap-2 border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground"
        href={discordInstallHref('/channels#discord')}
      >
        <Plus aria-hidden className="size-3.5" />
        {guilds.length === 0 ? 'Install Discord app' : 'Add server'}
      </a>
    </div>
  )
}

function discordInstallHref(returnTo: string): string {
  const params = new URLSearchParams({ returnTo })
  return `/api/channels/discord/install?${params.toString()}`
}
