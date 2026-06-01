import 'server-only'
import {
  getRelatedProjectOriginById,
  LOCAL_PROJECT_ORIGINS,
} from '../vercel-related-projects'
import {
  type AppRevalidationPayload,
  signAppRevalidationBody,
} from './app-revalidation'

const TRAILING_SLASHES = /\/+$/

export async function sendAppRevalidation(
  payload: AppRevalidationPayload
): Promise<void> {
  if (payload.tags.length === 0) {
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
  const origin = getRelatedProjectOriginById(
    process.env.VERCEL_APP_PROJECT_ID,
    LOCAL_PROJECT_ORIGINS.app
  ).replace(TRAILING_SLASHES, '')

  if (!origin) {
    throw new Error(
      'A related Vercel app project or NEXT_PUBLIC_APP_URL is required for app revalidation.'
    )
  }

  return origin
}
