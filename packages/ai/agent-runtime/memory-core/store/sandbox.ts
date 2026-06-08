import 'server-only'
import {
  getSystemSandbox,
  SYSTEM_SANDBOX_ROOT,
} from '@outname/ai/agent-runtime/server/agent-sandbox'
import type { Sandbox } from '@vercel/sandbox'
import type { DreamingStore } from '../types'
import { openDreamingSqlite } from './sql-js'

export const DREAMING_STORE_REL_PATH = 'memory/.dreams/dreaming.sqlite'
export const DREAMING_STORE_ABS_PATH = `${SYSTEM_SANDBOX_ROOT}/${DREAMING_STORE_REL_PATH}`

export async function withSandboxDreamingStore<T>(
  agentId: string,
  callback: (store: DreamingStore) => T | Promise<T>,
  options: { save?: boolean } = {}
): Promise<T> {
  const sandbox = await getSystemSandbox(agentId)
  const buffer = await readDreamingStoreBuffer(sandbox)
  const opened = await openDreamingSqlite({ buffer })
  const store: DreamingStore = {
    db: opened.db,
    export: opened.exportBytes,
    save: async () => {
      await writeDreamingStoreBuffer(sandbox, Buffer.from(opened.exportBytes()))
    },
  }
  try {
    const result = await callback(store)
    if (options.save !== false) {
      await store.save()
    }
    return result
  } finally {
    opened.sqlite.close()
  }
}

async function readDreamingStoreBuffer(
  sandbox: Sandbox
): Promise<Buffer | null> {
  try {
    return await sandbox.readFileToBuffer({ path: DREAMING_STORE_ABS_PATH })
  } catch (error) {
    if (isMissingFileError(error)) {
      return null
    }
    throw error
  }
}

async function writeDreamingStoreBuffer(
  sandbox: Sandbox,
  buffer: Buffer
): Promise<void> {
  const mkdir = await sandbox.runCommand({
    args: ['-p', `${SYSTEM_SANDBOX_ROOT}/memory/.dreams`],
    cmd: 'mkdir',
  })
  if (mkdir.exitCode !== 0) {
    const stderr = await mkdir.stderr()
    throw new Error(
      stderr.trim() || 'DreamingStore: failed to create store directory'
    )
  }
  await sandbox.writeFiles([{ content: buffer, path: DREAMING_STORE_ABS_PATH }])
}

function isMissingFileError(error: unknown): boolean {
  if (!(typeof error === 'object' && error !== null)) {
    return false
  }
  if ('code' in error && error.code === 'ENOENT') {
    return true
  }
  return (
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    error.response.status === 404
  )
}
