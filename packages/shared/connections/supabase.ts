import 'server-only'
import { z } from 'zod'
import { defineConnector } from './define-connector'

const WHITESPACE_PATTERN = /\s/

const supabaseCredentialSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(1, 'Required')
    .refine(
      (value) => !WHITESPACE_PATTERN.test(value),
      'Paste only the token value, without spaces.'
    ),
})

export type SupabaseCredential = z.infer<typeof supabaseCredentialSchema>

function metadataFromProjects(projects: unknown): Record<string, unknown> {
  if (!Array.isArray(projects) || projects.length === 0) {
    return {}
  }
  const first = projects[0]
  if (typeof first !== 'object' || first === null) {
    return { projectCount: projects.length }
  }
  const id = 'id' in first ? first.id : undefined
  const name = 'name' in first ? first.name : undefined
  return {
    projectCount: projects.length,
    ...(id === undefined ? {} : { firstProjectId: id }),
    ...(name === undefined ? {} : { firstProjectName: name }),
  }
}

export const supabaseConnector = defineConnector(
  'supabase.personal_access_token',
  {
    displayName: 'Supabase',
    description:
      'Supabase Management API connector used by the supabase.request maintainer tool.',
    credential: supabaseCredentialSchema,
    fields: [
      {
        name: 'apiKey',
        label: 'Personal access token',
        type: 'password',
        placeholder: 'sbp_... or your Supabase PAT',
        description:
          'Create a personal access token in Supabase account settings. The token is encrypted at rest before storage.',
      },
    ],
    broker: {
      allowedHosts: ['api.supabase.com'],
      injectedHeaderNames: ['authorization'],
      injectedHeaders: (credential: SupabaseCredential) => ({
        authorization: `Bearer ${credential.apiKey}`,
      }),
    },
    async validate(values) {
      const res = await fetch('https://api.supabase.com/v1/projects', {
        headers: {
          authorization: `Bearer ${values.apiKey}`,
        },
      })
      if (!res.ok) {
        return {
          ok: false,
          error: `Supabase rejected the token (HTTP ${res.status}). Double-check it and try again.`,
        }
      }

      const projects = (await res.json()) as unknown
      return {
        ok: true,
        metadata: metadataFromProjects(projects),
      }
    },
  }
)
