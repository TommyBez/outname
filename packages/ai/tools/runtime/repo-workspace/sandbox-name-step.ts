import { webcrypto } from 'node:crypto'

const REPO_WORKSPACE_SANDBOX_NAME_HASH_ALGORITHM = 'SHA-256'
const REPO_WORKSPACE_SANDBOX_NAME_HASH_LENGTH = 16
const REPO_WORKSPACE_SANDBOX_NAME_HASH_RADIX = 16
const REPO_WORKSPACE_SANDBOX_NAME_HASH_BYTE_WIDTH = 2

export async function hashRepoWorkspaceIdentityStep(input: {
  attachmentToolId: string
  repoUrl: string
}): Promise<string> {
  'use step'
  const digest = await webcrypto.subtle.digest(
    REPO_WORKSPACE_SANDBOX_NAME_HASH_ALGORITHM,
    new TextEncoder().encode(`${input.attachmentToolId}\0${input.repoUrl}`)
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte
      .toString(REPO_WORKSPACE_SANDBOX_NAME_HASH_RADIX)
      .padStart(REPO_WORKSPACE_SANDBOX_NAME_HASH_BYTE_WIDTH, '0')
  )
    .join('')
    .slice(0, REPO_WORKSPACE_SANDBOX_NAME_HASH_LENGTH)
}
