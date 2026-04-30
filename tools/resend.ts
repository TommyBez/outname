import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { resendApiKey } from '@/connectors/resend'
import type { MaintainerTool } from './types'

/**
 * Resend transactional email send. The api key is the credential layer
 * (one Resend account per user); `fromEmail` is the attachment-config
 * layer (which verified address THIS attachment sends from). Per-call
 * `to` / `subject` / `body` are the input layer.
 */

const resendConfigSchema = z.object({
  fromEmail: z
    .string()
    .email('Must be a verified Resend sender email address.')
    .describe(
      'Address each send is From:. Must be a verified domain or address in your Resend account, otherwise the API will reject.'
    ),
})

const resendSendInputSchema = z.object({
  to: z.string().email().describe('Recipient email address.'),
  subject: z.string().min(1),
  text: z
    .string()
    .min(1)
    .describe('Plain-text body. Use this for non-HTML sends.'),
  html: z
    .string()
    .optional()
    .describe('Optional HTML body — providers prefer this when present.'),
})

type ResendSendInput = z.infer<typeof resendSendInputSchema>

interface ExecuteResendSendArgs extends ResendSendInput {
  apiKey: string
  fromEmail: string
  toolId: string
}

async function executeResendSend(args: ExecuteResendSendArgs) {
  'use step'
  const body: Record<string, unknown> = {
    from: args.fromEmail,
    to: args.to,
    subject: args.subject,
    text: args.text,
  }
  if (args.html) {
    body.html = args.html
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    return {
      ok: false as const,
      error: `${args.toolId}: send failed (HTTP ${res.status}) ${errText.slice(0, 200)}`,
    }
  }
  const sent = (await res.json()) as { id: string }
  return { ok: true as const, id: sent.id }
}

export const resendSendTool: MaintainerTool = {
  id: 'resend_send',
  category: 'email',
  displayName: 'Resend · Send',
  description:
    'Send a transactional email via the Resend API using the configured sender address.',
  requirements: [{ kind: 'connection', provider: 'resend' }],
  configSchema: resendConfigSchema,
  configFields: [
    {
      name: 'fromEmail',
      label: 'From address',
      description:
        'Verified sender for this attachment (e.g. "alerts@yourdomain.com").',
      type: 'text',
      placeholder: 'alerts@yourdomain.com',
      required: true,
    },
  ],
  build({ credentials, config, toolId }) {
    const parsed = resendConfigSchema.parse(config)
    return tool({
      description:
        'Send a transactional email via Resend. Returns the new message id on success.',
      inputSchema: resendSendInputSchema,
      async execute({ to, subject, text, html }) {
        const apiKey = resendApiKey(credentials.resend)
        return await executeResendSend({
          apiKey,
          fromEmail: parsed.fromEmail,
          toolId,
          to,
          subject,
          text,
          html,
        })
      },
    })
  },
}
