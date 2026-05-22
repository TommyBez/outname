import { expect, test } from 'vitest'
import { buildTimezoneOptions } from './timezone-options'

test('buildTimezoneOptions keeps curated list and adds unknown current value', () => {
  const options = buildTimezoneOptions('Pacific/Kiritimati')
  expect(options[0]?.value).toBe('Pacific/Kiritimati')
  expect(options.some((option) => option.value === 'Europe/Rome')).toBe(true)
})
