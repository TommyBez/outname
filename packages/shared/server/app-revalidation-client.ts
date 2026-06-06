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
  const res = await fetch(`${origin}/api/internal/revalidate`, {
    body,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Outname-Revalidation-Signature': signAppRevalidationBody(body),
    },
    method: 'POST',
  })

  if (!res.ok) {
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
