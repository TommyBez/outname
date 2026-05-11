'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requireUserId } from '@/auth/server/auth-guard'
import { getConnector } from '@/connections/registry'
import {
  disconnectProvider,
  persistApiKeyConnection,
} from '@/connections/runtime/store'
import { userConnectionsTag } from '@/shared/server/cache-tags'

interface SaveApiKeyResult {
  error?: string
  ok: boolean
}

/**
 * Save an api_key connection. Used by the connection settings UI.
 * Server Actions get built-in CSRF (Next.js validates the action ID
 * and origin), so the api_key form does not need a separate token.
 */
export async function saveApiKeyConnectionAction(
  provider: string,
  values: Record<string, string>
): Promise<SaveApiKeyResult> {
  const userId = await requireUserId()

  const connector = getConnector(provider)
  if (!connector) {
    return { ok: false, error: 'Unknown provider.' }
  }

  const parsed = connector.apiKey.formSchema.safeParse(values)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  if (connector.apiKey.validate) {
    try {
      const result = await connector.apiKey.validate(values)
      if (!result.ok) {
        return { ok: false, error: result.error ?? 'Invalid credentials.' }
      }
      await persistApiKeyConnection({
        userId,
        provider,
        raw: parsed.data,
        metadata: result.metadata ?? {},
      })
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Validation failed.',
      }
    }
  } else {
    await persistApiKeyConnection({
      userId,
      provider,
      raw: parsed.data,
      metadata: {},
    })
  }

  updateConnectionSurfaces(userId)
  return { ok: true }
}

export async function disconnectConnectionAction(provider: string) {
  const userId = await requireUserId()

  if (!getConnector(provider)) {
    return { ok: false, error: 'Unknown provider.' }
  }

  await disconnectProvider({ userId, provider })
  updateConnectionSurfaces(userId)
  return { ok: true }
}

function updateConnectionSurfaces(userId: string): void {
  updateTag(userConnectionsTag(userId))
  revalidatePath('/connections')
}
