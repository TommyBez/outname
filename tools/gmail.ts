import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { googleAccessToken } from '@/connectors/google'
import type { MaintainerTool } from './types'

/**
 * Gmail tools. Both back onto the shared `google` connection — the
 * agent does one Google OAuth and gets every Gmail-shaped capability
 * it has attached.
 */

const GMAIL_READONLY = 'https://www.googleapis.com/auth/gmail.readonly'
const GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send'

interface MessageListResponse {
  messages?: Array<{ id: string; threadId: string }>
  nextPageToken?: string
  resultSizeEstimate?: number
}

interface MessageHeader {
  name: string
  value: string
}

interface Message {
  id: string
  threadId: string
  snippet?: string
  labelIds?: string[]
  internalDate?: string
  payload?: {
    headers?: MessageHeader[]
  }
}

function header(headers: MessageHeader[] | undefined, name: string): string {
  return (
    headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    ''
  )
}

export const gmailSearchTool: MaintainerTool = {
  id: 'gmail_search',
  category: 'gmail',
  displayName: 'Gmail · Search',
  description:
    'Search the connected Gmail account using Gmail query syntax (e.g. "from:billing@stripe.com newer_than:7d"). Returns up to 25 message summaries.',
  requirements: [{ kind: 'connection', provider: 'google', scopes: [GMAIL_READONLY] }],
  build({ credentials, toolId }) {
    return tool({
      description:
        'Search Gmail. Returns up to 25 messages (id, from, subject, date, snippet) for the given query.',
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe(
            'Gmail search query, e.g. "is:unread newer_than:24h" or "from:foo@bar.com".'
          ),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(25)
          .optional()
          .describe('Cap on returned messages (default 10, max 25).'),
      }),
      async execute({ query, maxResults }) {
        const token = googleAccessToken(credentials.google)
        const params = new URLSearchParams({
          q: query,
          maxResults: String(maxResults ?? 10),
        })
        const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`
        const listRes = await fetch(listUrl, {
          headers: { authorization: `Bearer ${token}` },
        })
        if (!listRes.ok) {
          return {
            ok: false as const,
            error: `${toolId}: list failed (HTTP ${listRes.status})`,
          }
        }
        const list = (await listRes.json()) as MessageListResponse
        const ids = (list.messages ?? []).map((m) => m.id)
        const detailed = await Promise.all(
          ids.map(async (id) => {
            const res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
              { headers: { authorization: `Bearer ${token}` } }
            )
            if (!res.ok) {
              return null
            }
            const msg = (await res.json()) as Message
            return {
              id: msg.id,
              threadId: msg.threadId,
              from: header(msg.payload?.headers, 'From'),
              subject: header(msg.payload?.headers, 'Subject'),
              date: header(msg.payload?.headers, 'Date'),
              snippet: msg.snippet ?? '',
              labels: msg.labelIds ?? [],
            }
          })
        )
        return {
          ok: true as const,
          messages: detailed.filter((m): m is NonNullable<typeof m> => m !== null),
          totalEstimate: list.resultSizeEstimate ?? null,
        }
      },
    })
  },
}

export const gmailSendTool: MaintainerTool = {
  id: 'gmail_send',
  category: 'gmail',
  displayName: 'Gmail · Send',
  description:
    'Send an email from the connected Gmail account. Plain-text body only; subject + recipients are required.',
  requirements: [{ kind: 'connection', provider: 'google', scopes: [GMAIL_SEND] }],
  build({ credentials, toolId }) {
    return tool({
      description:
        'Send a plain-text email from the connected Gmail account. Returns the new message id on success.',
      inputSchema: z.object({
        to: z.string().email().describe('Single recipient email address.'),
        subject: z.string().min(1),
        body: z.string().min(1).describe('Plain-text body. No HTML.'),
        cc: z.string().email().optional(),
        bcc: z.string().email().optional(),
      }),
      async execute({ to, subject, body, cc, bcc }) {
        const token = googleAccessToken(credentials.google)
        const headers: string[] = [`To: ${to}`, `Subject: ${subject}`]
        if (cc) {
          headers.push(`Cc: ${cc}`)
        }
        if (bcc) {
          headers.push(`Bcc: ${bcc}`)
        }
        headers.push('Content-Type: text/plain; charset="UTF-8"')
        const rfc2822 = `${headers.join('\r\n')}\r\n\r\n${body}`
        const raw = Buffer.from(rfc2822, 'utf8')
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')
        const res = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ raw }),
          }
        )
        if (!res.ok) {
          const text = await res.text()
          return {
            ok: false as const,
            error: `${toolId}: send failed (HTTP ${res.status}) ${text.slice(0, 200)}`,
          }
        }
        const sent = (await res.json()) as { id: string; threadId: string }
        return { ok: true as const, id: sent.id, threadId: sent.threadId }
      },
    })
  },
}
