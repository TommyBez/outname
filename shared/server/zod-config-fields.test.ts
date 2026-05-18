import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { describeConfigSchema } from './zod-config-fields'

vi.mock('server-only', () => ({}))

describe('describeConfigSchema', () => {
  test('describes Zod 4 object config fields', () => {
    const fields = describeConfigSchema(
      z.object({
        repoUrl: z
          .string()
          .min(1)
          .refine(() => true, 'Use an HTTPS GitHub repository URL.')
          .describe('HTTPS URL of the GitHub repository.'),
        defaultBaseBranch: z
          .string()
          .min(1)
          .default('main')
          .describe('Default base branch.'),
        readOnly: z.boolean().default(false).describe('Read-only mode.'),
      })
    )

    expect(fields).toEqual([
      {
        name: 'repoUrl',
        label: 'Repo Url',
        type: 'text',
        description: 'HTTPS URL of the GitHub repository.',
        defaultValue: undefined,
        required: true,
      },
      {
        name: 'defaultBaseBranch',
        label: 'Default Base Branch',
        type: 'text',
        description: 'Default base branch.',
        defaultValue: 'main',
        required: false,
      },
      {
        name: 'readOnly',
        label: 'Read Only',
        type: 'boolean',
        description: 'Read-only mode.',
        defaultValue: false,
        required: false,
      },
    ])
  })
})
