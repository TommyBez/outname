import { describe, expect, it } from 'vitest'
import { normalizeSkillName, parseSkillMd, SkillMdError } from './skill-md'

const NAME_PATTERN = /name/
const DESCRIPTION_PATTERN = /description/

describe('parseSkillMd', () => {
  it('parses valid frontmatter and preserves instruction formatting', () => {
    const parsed = parseSkillMd(`---
name: Grill With Docs
description: Stress-test a plan.
---

First line.

  - keep indentation
`)

    expect(parsed).toEqual({
      description: 'Stress-test a plan.',
      instructions: '\nFirst line.\n\n  - keep indentation\n',
      name: 'Grill With Docs',
      nameNormalized: 'grill with docs',
    })
  })

  it('rejects missing frontmatter', () => {
    expect(() => parseSkillMd('name: Nope')).toThrow(SkillMdError)
  })

  it('rejects invalid YAML', () => {
    expect(() =>
      parseSkillMd(`---
name: [oops
description: Broken
---
Body`)
    ).toThrow(SkillMdError)
  })

  it('rejects missing or empty required fields', () => {
    expect(() =>
      parseSkillMd(`---
description: Missing name
---
Body`)
    ).toThrow(NAME_PATTERN)
    expect(() =>
      parseSkillMd(`---
name: "  "
description: Empty name
---
Body`)
    ).toThrow(NAME_PATTERN)
    expect(() =>
      parseSkillMd(`---
name: Valid
---
Body`)
    ).toThrow(DESCRIPTION_PATTERN)
  })

  it('normalizes names case-insensitively', () => {
    expect(normalizeSkillName('  Grill With Docs  ')).toBe('grill with docs')
  })

  it('normalizes names with locale-stable NFC casing', () => {
    expect(normalizeSkillName('  E\u0301lite Skill  ')).toBe('élite skill')
  })
})
