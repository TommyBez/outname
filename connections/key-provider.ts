import 'server-only'

/**
 * Key source abstraction for encrypted connection credentials.
 *
 * v1 keeps the existing env-backed AES key, but all crypto callers now
 * depend on this interface so a KMS-backed or per-tenant DEK provider
 * can replace it without touching encryption call sites.
 */
export interface KeyProvider {
  getKey(): Buffer
}

class EnvKeyProvider implements KeyProvider {
  private cachedKey: Buffer | null = null

  getKey(): Buffer {
    if (this.cachedKey) {
      return this.cachedKey
    }
    const raw = process.env.CONNECTION_ENCRYPTION_KEY
    if (!raw) {
      throw new Error(
        'CONNECTION_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to the project env.'
      )
    }
    const buf = Buffer.from(raw, 'base64')
    if (buf.length !== 32) {
      throw new Error(
        `CONNECTION_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}). Did you set a base64-encoded 32-byte key?`
      )
    }
    this.cachedKey = buf
    return buf
  }
}

const provider: KeyProvider = new EnvKeyProvider()

export function getConnectionEncryptionKey(): Buffer {
  return provider.getKey()
}
