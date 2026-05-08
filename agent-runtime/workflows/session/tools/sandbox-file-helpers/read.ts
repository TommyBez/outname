import type { Sandbox } from '@vercel/sandbox'
import { type NormalizedSandboxPath, normalizeSandboxPath } from './paths'

export const MAX_READ_FILE_BYTES = 256 * 1024

export function readLiveFile(
  sandbox: Sandbox,
  rawPath: string
): Promise<string | null> {
  const safe = normalizeSandboxPath(rawPath)
  return readLiveFileByPath(sandbox, safe)
}

export async function readLiveFileByPath(
  sandbox: Sandbox,
  safe: NormalizedSandboxPath
): Promise<string | null> {
  const buf = await sandbox
    .readFileToBuffer({ path: safe.absPath })
    .catch(() => null)
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

export function readLiveMemory(
  sandbox: Sandbox,
  path: string
): Promise<string | null> {
  return readLiveFile(sandbox, path)
}
