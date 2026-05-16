import 'server-only'

import type { ReactElement } from 'react'
import { Resend } from 'resend'

let resendClient: Resend | null = null

function getResendApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set')
  }
  return apiKey
}

export function getResendClient(): Resend {
  if (resendClient) {
    return resendClient
  }

  resendClient = new Resend(getResendApiKey())
  return resendClient
}

export async function sendResendReactEmail(input: {
  from: string
  idempotencyKey: string
  react: ReactElement
  replyTo: string
  subject: string
  to: string
}) {
  const { error } = await getResendClient().emails.send(
    {
      from: input.from,
      replyTo: input.replyTo,
      subject: input.subject,
      to: [input.to],
      react: input.react,
    },
    {
      idempotencyKey: input.idempotencyKey,
    }
  )

  if (error) {
    const statusCodeSuffix = error.statusCode ? ` (${error.statusCode})` : ''
    throw new Error(
      `Resend email send failed [${error.name}]${statusCodeSuffix}: ${error.message}`
    )
  }
}
