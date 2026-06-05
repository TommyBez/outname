import { describe, expect, it, vi } from 'vitest'
import { discoverRuntimeSkills } from './discovery'
import { SKILL_PACKAGES_DIR } from './paths'

describe('discoverRuntimeSkills', () => {
  it('discovers valid immediate skills from the sandbox', async () => {
    const sandbox = createSandbox({
      [`${SKILL_PACKAGES_DIR}/grill/SKILL.md`]: skillMd({
        description: 'Stress-test a plan.',
        name: 'Grill With Docs',
      }),
    })

    await expect(discoverRuntimeSkills({ sandbox })).resolves.toEqual([
      {
        description: 'Stress-test a plan.',
        name: 'Grill With Docs',
        nameNormalized: 'grill with docs',
        path: `${SKILL_PACKAGES_DIR}/grill`,
        skillMdPath: `${SKILL_PACKAGES_DIR}/grill/SKILL.md`,
        slug: 'grill',
      },
    ])
  })

  it('ignores invalid files, dot slugs, and duplicate names deterministically', async () => {
    const sandbox = createSandbox({
      [`${SKILL_PACKAGES_DIR}/.staging/SKILL.md`]: skillMd({
        description: 'Hidden',
        name: 'Hidden',
      }),
      [`${SKILL_PACKAGES_DIR}/alpha/SKILL.md`]: skillMd({
        description: 'First',
        name: 'Same Name',
      }),
      [`${SKILL_PACKAGES_DIR}/beta/SKILL.md`]: skillMd({
        description: 'Second',
        name: 'same name',
      }),
      [`${SKILL_PACKAGES_DIR}/broken/SKILL.md`]: 'not frontmatter',
    })

    await expect(discoverRuntimeSkills({ sandbox })).resolves.toEqual([
      {
        description: 'First',
        name: 'Same Name',
        nameNormalized: 'same name',
        path: `${SKILL_PACKAGES_DIR}/alpha`,
        skillMdPath: `${SKILL_PACKAGES_DIR}/alpha/SKILL.md`,
        slug: 'alpha',
      },
    ])
  })
})

function createSandbox(files: Record<string, string>) {
  return {
    readFileToBuffer: vi.fn(async ({ path }: { path: string }) =>
      files[path] ? Buffer.from(files[path], 'utf8') : null
    ),
    runCommand: vi.fn(async () => ({
      exitCode: 0,
      stderr: async () => '',
      stdout: async () =>
        Object.keys(files)
          .filter((path) => path.endsWith('/SKILL.md'))
          .join('\n'),
    })),
  } as unknown as Parameters<typeof discoverRuntimeSkills>[0]['sandbox']
}

function skillMd(input: { description: string; name: string }): string {
  return `---
name: ${input.name}
description: ${input.description}
---

Body
`
}
