import type { Sandbox } from '@vercel/sandbox'
import { type NormalizedSandboxPath, normalizeSandboxPath } from './paths'

const MAX_READ_FILE_BYTES = 256 * 1024

export function readLiveFile(
  sandbox: Sandbox,
  rawPath: string
): Promise<string | null> {
  const safe = normalizeSandboxPath(rawPath)
  return readLiveFileByPath(sandbox, safe)
}

async function readLiveFileByPath(
  sandbox: Sandbox,
  safe: NormalizedSandboxPath
): Promise<string | null> {
  let buf: Buffer | null
  try {
    buf = await sandbox.readFileToBuffer({ path: safe.absPath })
  } catch (error) {
    if (isMissingFileError(error)) {
      return null
    }
    throw error
  }
  if (!buf) {
    return null
  }
  if (buf.byteLength > MAX_READ_FILE_BYTES) {
    throw new Error(
      `readFile: ${safe.relPath} is ${buf.byteLength} bytes; max readable size is ${MAX_READ_FILE_BYTES} bytes.`
    )
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    throw new Error(`readFile: ${safe.relPath} is not valid UTF-8 text.`)
  }
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
