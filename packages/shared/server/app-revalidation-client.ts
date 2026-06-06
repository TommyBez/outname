import 'server-only'
import { withRelatedProject } from '@vercel/related-projects'
import {
  LOCAL_PROJECT_ORIGINS,
  PROJECT_NAMES,
} from '../vercel-related-projects'
import {
  type AppRevalidationPayload,
  signAppRevalidationBody,
} from './app-revalidation'

export async function sendAppRevalidation(
  payload: AppRevalidationPayload
): Promise<void> {
  if (payload.tags.length === 0 && (payload.paths?.length ?? 0) === 0) {
    return
  }

  const origin = appRevalidationOrigin()
  const body = JSON.stringify(payload)
  const protectionBypassSecret =
    process.env.APP_VERCEL_AUTOMATION_BYPASS_SECRET?.trim()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Outname-Revalidation-Signature': signAppRevalidationBody(body),
  }
  if (protectionBypassSecret) {
    headers['x-vercel-protection-bypass'] = protectionBypassSecret
  }

  const res = await fetch(`${origin}/api/internal/revalidate`, {
    body,
    cache: 'no-store',
    headers,
    method: 'POST',
  })

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        'App revalidation failed with status 401. If the app preview deployment is protected, set APP_VERCEL_AUTOMATION_BYPASS_SECRET on the API project to the app project protection bypass secret.'
      )
    }
    throw new Error(`App revalidation failed with status ${res.status}`)
  }
}

function appRevalidationOrigin(): string {
  const origin = withRelatedProject({
    defaultHost: LOCAL_PROJECT_ORIGINS.app,
    projectName: PROJECT_NAMES.app,
  })

  if (!origin) {
    throw new Error(
      'A related Vercel app project or NEXT_PUBLIC_APP_URL is required for app revalidation.'
    )
  }

  return origin
}
