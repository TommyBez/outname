import 'server-only'

import { discordBotFetch, readDiscordJson } from './api'

export const DISCORD_AGENT_COMMAND_VERSION = 1

const AGENT_COMMAND_NAME = 'agent'
const AGENT_COMMAND_DESCRIPTION =
  'Run your OUTNA.ME agent in this Discord context.'

interface DiscordApplicationCommand {
  description?: string
  id: string
  name: string
  options?: DiscordApplicationCommandOption[]
  type?: number
}

interface DiscordApplicationCommandOption {
  description: string
  name: string
  required?: boolean
  type: number
}

interface DiscordCommandPayload {
  description: string
  name: string
  options: DiscordApplicationCommandOption[]
  type: number
}

export async function ensureDiscordAgentCommand(
  guildId: string
): Promise<number> {
  const applicationId = process.env.DISCORD_APPLICATION_ID
  if (!applicationId) {
    throw new Error(
      'DISCORD_APPLICATION_ID is required to register Discord slash commands.'
    )
  }

  const commandPath = `/applications/${applicationId}/guilds/${guildId}/commands`
  const response = await discordBotFetch(commandPath)
  const commands = await readDiscordJson<DiscordApplicationCommand[]>(response)
  const expected = expectedAgentCommand()
  const current = commands.find(
    (command) => command.name === AGENT_COMMAND_NAME
  )

  if (!current) {
    await discordBotFetch(commandPath, {
      body: expected,
      method: 'POST',
    })
    return DISCORD_AGENT_COMMAND_VERSION
  }

  if (isExpectedAgentCommand(current, expected)) {
    return DISCORD_AGENT_COMMAND_VERSION
  }

  await discordBotFetch(`${commandPath}/${current.id}`, {
    body: expected,
    method: 'PATCH',
  })
  return DISCORD_AGENT_COMMAND_VERSION
}

function expectedAgentCommand(): DiscordCommandPayload {
  return {
    description: AGENT_COMMAND_DESCRIPTION,
    name: AGENT_COMMAND_NAME,
    options: [
      {
        description: 'What should the agent do?',
        name: 'prompt',
        required: true,
        type: 3,
      },
    ],
    type: 1,
  }
}

function isExpectedAgentCommand(
  current: DiscordApplicationCommand,
  expected: DiscordCommandPayload
): boolean {
  if (
    current.name !== expected.name ||
    current.description !== expected.description ||
    current.type !== expected.type
  ) {
    return false
  }

  const [currentPrompt] = current.options ?? []
  const [expectedPrompt] = expected.options
  return (
    currentPrompt?.name === expectedPrompt.name &&
    currentPrompt.description === expectedPrompt.description &&
    currentPrompt.type === expectedPrompt.type &&
    currentPrompt.required === expectedPrompt.required
  )
}
