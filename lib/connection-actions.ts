'use server'

import { revalidateTag } from 'next/cache'
import { getConnector } from '@/connectors/registry'
import {
  disconnectProvider,
  persistApiKeyConnection,
} from '@/connectors/runtime'
import { requireUserId } from '@/lib/auth-guard'
import { userConnectionsTag } from '@/lib/cache-tags'

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
      const result = await connector.apiKey.validate(parsed.data)
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

  revalidateTag(userConnectionsTag(userId), 'max')
  return { ok: true }
}

export async function disconnectConnectionAction(provider: string) {
  const userId = await requireUserId()

  if (!getConnector(provider)) {
    return { ok: false, error: 'Unknown provider.' }
  }

  await disconnectProvider({ userId, provider })
  revalidateTag(userConnectionsTag(userId), 'max')
  return { ok: true }
}
