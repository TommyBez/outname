import { describe, expect, it } from 'vitest'
import {
  containsPromotionMarker,
  extractPromotionKeys,
  renderOutnamePromotionMarker,
} from './markers'

describe('dreaming promotion markers', () => {
  it('renders and extracts Outname-owned promotion markers', () => {
    const marker = renderOutnamePromotionMarker({
      at: '2026-06-08T10:00:00.000Z',
      key: 'mem_123',
      source: 'logs/2026-06-08.md:4',
    })

    expect(marker).toBe(
      '<!-- outname:dreaming:promotion key="mem_123" source="logs/2026-06-08.md:4" at="2026-06-08T10:00:00.000Z" -->'
    )
    expect(extractPromotionKeys(`- Memory ${marker}`)).toEqual(
      new Set(['mem_123'])
    )
    expect(containsPromotionMarker(`- Memory ${marker}`, 'mem_123')).toBe(true)
  })
})
