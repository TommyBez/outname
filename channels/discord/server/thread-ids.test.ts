import { expect, test } from 'vitest'
import {
  describeDiscordAttachments,
  discordGuildScope,
  discordUserScope,
  extractDiscordThread,
  parseDiscordThreadId,
} from './thread-ids'

test('discord scope helpers build guild and user installation keys', () => {
  expect(discordGuildScope('123')).toBe('guild:123')
  expect(discordUserScope('456')).toBe('user:456')
})

test('parseDiscordThreadId accepts channel and thread ids', () => {
  expect(parseDiscordThreadId('discord:guild_1:channel_1:thread_1')).toEqual({
    channelId: 'channel_1',
    guildId: 'guild_1',
    threadId: 'thread_1',
  })
  expect(parseDiscordThreadId('discord:guild_1:channel_1')).toEqual({
    channelId: 'channel_1',
    guildId: 'guild_1',
  })
})

test('extractDiscordThread falls back to raw thread parent data', () => {
  expect(
    extractDiscordThread(
      {
        channelId: 'discord:guild_1:parent_1',
        id: 'unencoded',
      },
      {
        channel_id: 'thread_1',
        guild_id: 'guild_1',
        thread: {
          id: 'thread_1',
          parent_id: 'parent_1',
        },
      }
    )
  ).toEqual({
    channelId: 'parent_1',
    guildId: 'guild_1',
    threadId: 'thread_1',
  })
})

test('describeDiscordAttachments lists filename and mime type', () => {
  expect(
    describeDiscordAttachments({
      attachments: [
        {
          content_type: 'image/png',
          filename: 'diagram.png',
        },
        {
          filename: 'notes.txt',
        },
      ],
    })
  ).toBe('diagram.png (image/png), notes.txt')
})
