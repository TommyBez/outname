import 'server-only'
import { z } from 'zod'
import { defineConnector } from './define-connector'

const CALCOM_API_VERSION = '2024-08-13'

const calcomCredentialSchema = z.object({
  apiKey: z
    .string()
    .min(1, 'Required')
    .refine(
      (value) => value.startsWith('cal_') || value.startsWith('cal_live_'),
      'Cal.com API keys start with "cal_" or "cal_live_".'
    ),
})

export type CalcomCredential = z.infer<typeof calcomCredentialSchema>

function metadataFromProfile(profile: {
  data?: {
    email?: string
    id?: number | string
    name?: string
    username?: string
  }
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(profile.data ?? {})) {
    if (value !== undefined) {
      metadata[key] = value
    }
  }
  return metadata
}

export const calcomConnector = defineConnector('calcom', {
  displayName: 'Cal.com',
  description: 'Scheduling and booking automation via the Cal.com API v2.',
  credential: calcomCredentialSchema,
  fields: [
    {
      name: 'apiKey',
      label: 'API key',
      type: 'password',
      placeholder: 'cal_... or cal_live_...',
      description:
        'Generate in Cal.com under Settings > Security. The key is encrypted at rest before storage.',
    },
  ],
  broker: {
    allowedHosts: ['api.cal.com'] as const,
    injectedHeaderNames: ['authorization'] as const,
    injectedHeaders: (credential: CalcomCredential) => ({
      authorization: `Bearer ${credential.apiKey}`,
    }),
  },
  async validate(values) {
    const res = await fetch('https://api.cal.com/v2/me', {
      headers: {
        authorization: `Bearer ${values.apiKey}`,
        'cal-api-version': CALCOM_API_VERSION,
      },
    })
    if (!res.ok) {
      return {
        ok: false,
        error: `Cal.com rejected the key (HTTP ${res.status}). Double-check it and try again.`,
      }
    }

    const profile = (await res.json()) as {
      data?: {
        email?: string
        id?: number | string
        name?: string
        username?: string
      }
    }
    return {
      ok: true,
      metadata: metadataFromProfile(profile),
    }
  },
})
