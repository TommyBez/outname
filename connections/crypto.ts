import 'server-only'
import { getConnectionEncryptionKey } from '@/connections/key-provider'

// Envelope layout: version(1) | iv(12) | tag(16) | ciphertext(N).
// The version byte is part of the stored format, so rotations need a
// matching decrypt path for older rows.
const VERSION = 0x01
const IV_LEN = 12
const TAG_LEN = 16

let cachedAesKey: Promise<CryptoKey> | null = null

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('Web Crypto is unavailable in this runtime.')
  }
  return subtle
}

function getWebCrypto(): Crypto {
  const webCrypto = globalThis.crypto
  if (!webCrypto) {
    throw new Error('Web Crypto is unavailable in this runtime.')
  }
  return webCrypto
}

async function getAesKey(): Promise<CryptoKey> {
  if (!cachedAesKey) {
    const subtle = getSubtleCrypto()
    const rawKey = Uint8Array.from(getConnectionEncryptionKey())
    cachedAesKey = subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    )
  }
  return await cachedAesKey
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

export async function encryptCredential(value: unknown): Promise<string> {
  const webCrypto = getWebCrypto()
  const subtle = getSubtleCrypto()
  const key = await getAesKey()
  // AES-GCM IVs must be unique per encryption under the same key.
  const iv = webCrypto.getRandomValues(new Uint8Array(IV_LEN))
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const ciphertextWithTag = new Uint8Array(
    await subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: TAG_LEN * 8 },
      key,
      plaintext
    )
  )
  const ciphertext = ciphertextWithTag.subarray(
    0,
    ciphertextWithTag.length - TAG_LEN
  )
  const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - TAG_LEN)
  const envelope = concatBytes([Uint8Array.of(VERSION), iv, tag, ciphertext])
  return Buffer.from(envelope).toString('base64')
}

export async function decryptCredential<T = unknown>(
  envelopeB64: string
): Promise<T> {
  const subtle = getSubtleCrypto()
  const key = await getAesKey()
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
  const plaintext = new Uint8Array(
    await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: TAG_LEN * 8,
      },
      key,
      Uint8Array.from(concatBytes([ciphertext, tag]))
    )
  )
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}
