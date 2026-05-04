import 'server-only'
import { z } from 'zod'
import {
  defineActionTool,
  type ToolPolicy,
  toolError,
  toolSuccess,
} from './define-maintainer-tool'

/**
 * Resend transactional email send. The api key is never handed to this
 * tool. The provider call runs through brokered HTTP, where Vercel
 * Sandbox injects the Authorization header outside the VM boundary.
 */

const resendConfigSchema = z.object({
  fromEmail: z
    .string()
    .email('Must be a verified Resend sender email address.')
    .describe(
      'Verified sender for this attachment (for example alerts@yourdomain.com).'
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
    .describe('Optional HTML body. Providers prefer this when present.'),
})

type ResendConfig = z.infer<typeof resendConfigSchema>
type ResendSendInput = z.infer<typeof resendSendInputSchema>

const requireConfiguredSender: ToolPolicy<ResendSendInput, ResendConfig> = ({
  config,
}) => {
  if (!config.fromEmail.includes('@')) {
    return { ok: false, message: 'Configured sender email is invalid.' }
  }
  return { ok: true }
}

export const resendSendTool = defineActionTool({
  id: 'resend_send',
  category: 'email',
  displayName: 'Resend · Send',
  description:
    'Send a transactional email via Resend using the configured sender address.',
  capabilities: [{ kind: 'brokered_http', provider: 'resend' }],
  configSchema: resendConfigSchema,
  inputSchema: resendSendInputSchema,
  policies: [requireConfiguredSender],
  async execute({ input, config, ctx }) {
    const body: Record<string, unknown> = {
      from: config.fromEmail,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }
    if (input.html) {
      body.html = input.html
    }

    const response = await ctx.http.request('resend', {
      method: 'POST',
      url: 'https://api.resend.com/emails',
      headers: { 'content-type': 'application/json' },
      body,
    })
    if (!response.ok) {
      return toolError(
        'provider_error',
        `Resend rejected the send request (HTTP ${response.status}).`
      )
    }

    const parsed = JSON.parse(response.bodyText) as { id?: unknown }
    if (typeof parsed.id !== 'string') {
      return toolError('provider_error', 'Resend did not return a message id.')
    }
    return toolSuccess({ id: parsed.id })
  },
})
