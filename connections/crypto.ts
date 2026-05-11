import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { getConnectionEncryptionKey } from '@/connections/key-provider'

/**
 * AES-256-GCM at-rest encryption for `user_connections.credentials`.
 *
 * Envelope (base64-encoded as a single string):
 *
 *     version(1) | iv(12) | tag(16) | ciphertext(N)
 *
 * The version byte lets us migrate algorithms or rotate keys later
 * without re-reading every row in a single big-bang. Today only `0x01`
 * is defined.
 *
 * Key sourcing is delegated to `lib/key-provider.ts`. The current
 * provider still reads `CONNECTION_ENCRYPTION_KEY`; future KMS or
 * per-tenant DEK providers can slot in behind the same interface.
 */

const VERSION = 0x01
const IV_LEN = 12
const TAG_LEN = 16

/**
 * Encrypt an arbitrary JSON-serialisable value into a base64 envelope.
 * Each call uses a fresh random IV — never reuse one with the same key.
 */
export function encryptCredential(value: unknown): string {
  const key = getConnectionEncryptionKey()
  const iv = randomBytes(IV_LEN)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  const envelope = Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext])
  return envelope.toString('base64')
}

/**
 * Decrypt a base64 envelope produced by `encryptCredential`. Throws on
 * any tampering, key mismatch, or unknown version byte.
 */
export function decryptCredential<T = unknown>(envelopeB64: string): T {
  const key = getConnectionEncryptionKey()
  const envelope = Buffer.from(envelopeB64, 'base64')
  if (envelope.length < 1 + IV_LEN + TAG_LEN) {
    throw new Error('decryptCredential: envelope too short')
  }
  const version = envelope.readUInt8(0)
  if (version !== VERSION) {
    throw new Error(
      `decryptCredential: unknown envelope version 0x${version.toString(16)}`
    )
  }
  const iv = envelope.subarray(1, 1 + IV_LEN)
  const tag = envelope.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN)
  const ciphertext = envelope.subarray(1 + IV_LEN + TAG_LEN)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return JSON.parse(plaintext.toString('utf8')) as T
}
