import 'server-only'
import { withRelatedProject } from '@vercel/related-projects'
import {
  type AppRevalidationPayload,
  signAppRevalidationBody,
} from './app-revalidation'

const APP_RELATED_PROJECT_NAME = 'outname-app'
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
  const origin = withRelatedProject({
    defaultHost: process.env.NEXT_PUBLIC_APP_URL ?? '',
    projectName: APP_RELATED_PROJECT_NAME,
  }).replace(TRAILING_SLASHES, '')

  if (!origin) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL or related project outname-app is required for app revalidation.'
    )
  }

  return origin
}
