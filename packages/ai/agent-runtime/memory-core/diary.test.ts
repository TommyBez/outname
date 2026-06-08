import { describe, expect, it } from 'vitest'
import {
  appendDiarySection,
  appendNarrativeToDiarySection,
  renderDeterministicDiarySection,
} from './diary'

describe('dreaming diary rendering', () => {
  it('renders deterministic diary sections and appends narrative', () => {
    const section = renderDeterministicDiarySection({
      completedAt: '2026-06-08T12:00:00.000Z',
      localDate: '2026-06-08',
      summary: {
        deep: {
          candidatesConsidered: 1,
          evidenceSnippets: 0,
          phase: 'deep',
          promotions: [{ key: 'mem_1', marker: '<!-- marker -->', text: 'A' }],
          signalsWritten: 1,
        },
        light: {
          candidatesConsidered: 2,
          evidenceSnippets: 3,
          phase: 'light',
          signalsWritten: 1,
        },
        rem: {
          candidatesConsidered: 2,
          evidenceSnippets: 0,
          phase: 'rem',
          signalsWritten: 2,
        },
        sweepId: 'sweep_evt',
      },
    })

    expect(section).toContain('## 2026-06-08')
    expect(section).toContain('Deep: 1 promotions written')
    expect(
      appendNarrativeToDiarySection({ narrative: '- Useful', section })
    ).toContain('### Narrative\n- Useful')
    expect(
      appendDiarySection({ existingDreams: '# Dreams\n', section })
    ).toContain('# Dreams\n\n## 2026-06-08')
  })
})
