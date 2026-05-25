import { createClient } from 'redis'

const LEGACY_PREFIX = 'slack-chat-sdk:*'
const BATCH_SIZE = 100

async function main(): Promise<void> {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL is required.')
  }

  const apply = process.argv.includes('--apply')
  const client = createClient({ url })
  client.on('error', (error) => {
    console.error('[cleanup-legacy-slack-chat-sdk-redis] redis error', error)
  })
  await client.connect()

  let total = 0
  let batch: string[] = []
  for await (const scanKeys of client.scanIterator({
    COUNT: BATCH_SIZE,
    MATCH: LEGACY_PREFIX,
  })) {
    const keys = Array.isArray(scanKeys) ? scanKeys : [scanKeys]
    total += keys.length
    batch.push(...keys)
    if (batch.length >= BATCH_SIZE) {
      await flushBatch(client, batch, apply)
      batch = []
    }
  }
  await flushBatch(client, batch, apply)
  await client.quit()

  const mode = apply ? 'deleted' : 'found'
  console.log(`${mode} ${total} legacy Slack Chat SDK Redis key(s).`)
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to delete matching keys.')
  }
}

async function flushBatch(
  client: ReturnType<typeof createClient>,
  keys: string[],
  apply: boolean
): Promise<void> {
  if (!(apply && keys.length > 0)) {
    return
  }
  for (const key of keys) {
    await client.del(key)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
