import 'server-only'
import { after } from 'next/server'
import type { AppRevalidationPayload } from './app-revalidation'
import { sendAppRevalidation } from './app-revalidation-client'

export function revalidateAppAfter(
  tags: AppRevalidationPayload['tags'],
  paths: string[] = []
): void {
  if (tags.length === 0 && paths.length === 0) {
    return
  }
  after(async () => {
    try {
      await sendAppRevalidation({ paths, tags })
    } catch (error) {
      console.error('[app-revalidation] failed', error)
    }
  })
}
