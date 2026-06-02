import 'server-only'
import { after } from 'next/server'
import type { AppRevalidationPayload } from './app-revalidation'
import { sendAppRevalidation } from './app-revalidation-client'

export function revalidateAppAfter(tags: AppRevalidationPayload['tags']): void {
  if (tags.length === 0) {
    return
  }
  after(async () => {
    try {
      await sendAppRevalidation({ tags })
    } catch (error) {
      console.error('[app-revalidation] failed', error)
    }
  })
}
