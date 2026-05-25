import 'server-only'

export const DISCORD_API_BASE_URL =
  process.env.DISCORD_API_URL ?? 'https://discord.com/api/v10'

export class DiscordApiError extends Error {
  readonly body: string
  readonly status: number

  constructor(message: string, status: number, body: string) {
    super(message)
    this.name = 'DiscordApiError'
    this.body = body
    this.status = status
  }
}

export async function discordBotFetch(
  path: string,
  init: {
    body?: unknown
    method?: string
    signal?: AbortSignal
  } = {}
): Promise<Response> {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is required for Discord bot API calls.')
  }
  const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers: {
      authorization: `Bot ${token}`,
      ...(init.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
    },
    method: init.method ?? 'GET',
    signal: init.signal,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new DiscordApiError(
      `Discord API request failed (${response.status})`,
      response.status,
      text
    )
  }
  return response
}

export async function readDiscordJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}
