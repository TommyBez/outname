import { expect, test } from 'vitest'
import { normalizeDatabaseUrlForPg } from './connection-string'

test.each([
  'prefer',
  'require',
  'verify-ca',
])('normalizes sslmode=%s to verify-full', (sslMode) => {
  const normalizedUrl = normalizeDatabaseUrlForPg(
    `postgresql://user:password@db.example.com/app?sslmode=${sslMode}`
  )

  expect(normalizedUrl).toContain('sslmode=verify-full')
})

test('preserves explicit libpq compatibility mode', () => {
  const databaseUrl =
    'postgresql://user:password@db.example.com/app?uselibpqcompat=true&sslmode=require'

  expect(normalizeDatabaseUrlForPg(databaseUrl)).toBe(databaseUrl)
})

test('leaves already explicit verify-full unchanged', () => {
  const databaseUrl =
    'postgresql://user:password@db.example.com/app?sslmode=verify-full'

  expect(normalizeDatabaseUrlForPg(databaseUrl)).toBe(databaseUrl)
})

test('leaves urls without sslmode unchanged', () => {
  const databaseUrl =
    'postgresql://user:password@db.example.com/app?channel_binding=require'

  expect(normalizeDatabaseUrlForPg(databaseUrl)).toBe(databaseUrl)
})
