import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildIncomingSlackMessage,
  buildIncomingSlackTurn,
  type SlackMessage,
  type SlackThread,
} from './incoming-message'

vi.mock('server-only', () => ({}))

const DEFAULT_DATE = new Date('2024-03-09T16:00:00.123Z')

describe('buildIncomingSlackMessage', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('uses Chat SDK message id and dateSent as canonical message fields', () => {
    const incoming = buildIncomingSlackMessage({
      message: buildSlackMessage(),
      thread: buildSlackThread(),
    })

    expect(incoming).toMatchObject({
      createdAt: DEFAULT_DATE,
      externalMessageKey: 'slack-message-1',
      externalUserDisplayName: 'Ada Lovelace',
      externalUserId: 'U123',
      text: 'hello',
    })
  })

  it('preserves Slack metadata passively', () => {
    const incoming = buildIncomingSlackMessage({
      message: buildSlackMessage(),
      thread: buildSlackThread(),
    })

    expect(incoming?.providerMetadata).toEqual({
      slackChannel: 'C123',
      slackMessageTs: '1710000000.123456',
      slackThreadTs: '1710000000.123456',
      slackTeamId: 'T123',
    })
  })

  it('returns null when the message has no text or attachments', () => {
    const incoming = buildIncomingSlackMessage({
      message: buildSlackMessage({ text: '   ' }),
      thread: buildSlackThread(),
    })

    expect(incoming).toBeNull()
  })

  it('returns null when Slack thread ids cannot be resolved', () => {
    const incoming = buildIncomingSlackMessage({
      message: buildSlackMessage({ raw: { team: 'T123' } }),
      thread: buildSlackThread({ channelId: '', id: '' }),
    })

    expect(incoming).toBeNull()
  })

  it('returns null when the turn has no Slack team id', () => {
    const incoming = buildIncomingSlackTurn({
      kind: 'channel',
      message: buildSlackMessage({
        raw: {
          channel: 'C123',
          ts: '1710000000.123456',
          thread_ts: '1710000000.123456',
        },
      }),
      thread: buildSlackThread(),
    })

    expect(incoming).toBeNull()
  })

  it('builds a turn with Chat SDK thread id as canonical external thread id', () => {
    const turn = buildIncomingSlackTurn({
      kind: 'channel',
      message: buildSlackMessage(),
      thread: buildSlackThread(),
    })

    expect(turn).toMatchObject({
      channel: 'slack',
      externalScopeId: 'T123',
      externalThreadId: 'slack:C123:1710000000.123456',
      routing: {
        key: 'C123',
        kind: 'channel',
      },
    })
    expect(turn?.current.externalMessageKey).toBe('slack-message-1')
    expect(turn?.providerMetadata).toEqual({
      slackChannel: 'C123',
      slackMessageTs: '1710000000.123456',
      slackThreadTs: '1710000000.123456',
      slackTeamId: 'T123',
    })
  })
})

function buildSlackThread(
  input: Partial<Pick<SlackThread, 'channelId' | 'id' | 'isDM'>> = {}
): SlackThread {
  return {
    channelId: input.channelId ?? 'C123',
    id: input.id ?? 'slack:C123:1710000000.123456',
    isDM: input.isDM ?? false,
  } as SlackThread
}

function buildSlackMessage(
  input: { raw?: Record<string, unknown>; text?: string } = {}
): SlackMessage {
  return {
    author: {
      fullName: 'Ada Lovelace',
      userId: 'U123',
      userName: 'ada',
    },
    id: 'slack-message-1',
    metadata: {
      dateSent: DEFAULT_DATE,
    },
    raw: input.raw ?? {
      channel: 'C123',
      team: 'T123',
      thread_ts: '1710000000.123456',
      ts: '1710000000.123456',
    },
    text: input.text ?? ' hello ',
  } as SlackMessage
}
