import 'server-only'

import { readBrokeredCredential } from '@/connections/runtime/credential'
import type { RawCredential } from '@/connections/types'
import { readCredentialOverride } from './api-key-override'

export async function readProviderCredential(input: {
  provider: string
  toolConfig?: Record<string, unknown>
  userId: string
}): Promise<RawCredential> {
  const override = await readCredentialOverride({
    config: input.toolConfig,
    provider: input.provider,
  })
  if (override !== undefined) {
    return override
  }

  return await readBrokeredCredential({
    provider: input.provider,
    userId: input.userId,
  })
}
