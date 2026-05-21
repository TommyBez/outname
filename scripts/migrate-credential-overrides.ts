import { and, eq } from 'drizzle-orm'
import { legacyProviderToConnectorId } from '@/connections/legacy-provider-map'
import { db } from '@/shared/db'
import { agentTools } from '@/shared/db/schema'

const SECRETS_FIELD = '_secrets'
const CREDENTIAL_OVERRIDES_FIELD = 'credentialOverrides'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function migrateConfig(config: unknown): {
  changed: boolean
  config: Record<string, unknown>
} {
  if (!isRecord(config)) {
    return { changed: false, config: {} }
  }

  const secrets = config[SECRETS_FIELD]
  if (!isRecord(secrets)) {
    return { changed: false, config }
  }

  const overrides = secrets[CREDENTIAL_OVERRIDES_FIELD]
  if (!isRecord(overrides)) {
    return { changed: false, config }
  }

  let changed = false
  const nextOverrides: Record<string, unknown> = {}
  const originalKeys = new Set(Object.keys(overrides))
  for (const [key, value] of Object.entries(overrides)) {
    const connectorId = legacyProviderToConnectorId(key)
    if (connectorId !== key && originalKeys.has(connectorId)) {
      nextOverrides[key] = value
      continue
    }
    nextOverrides[connectorId] = value
    changed ||= connectorId !== key
  }

  if (!changed) {
    return { changed: false, config }
  }

  return {
    changed: true,
    config: {
      ...config,
      [SECRETS_FIELD]: {
        ...secrets,
        [CREDENTIAL_OVERRIDES_FIELD]: nextOverrides,
      },
    },
  }
}

async function main(): Promise<void> {
  const rows = await db.select().from(agentTools)
  let updated = 0
  for (const row of rows) {
    const migrated = migrateConfig(row.config)
    if (!migrated.changed) {
      continue
    }
    await db
      .update(agentTools)
      .set({ config: migrated.config, updatedAt: new Date() })
      .where(
        and(
          eq(agentTools.agentId, row.agentId),
          eq(agentTools.kind, row.kind),
          eq(agentTools.toolId, row.toolId)
        )
      )
    updated += 1
  }
  console.log(`Migrated credential override configs: ${updated}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
