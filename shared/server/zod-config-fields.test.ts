import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

vi.mock('server-only', () => ({}))

import { describeConfigSchema } from './zod-config-fields'

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

  test('extracts generic v4 object fields and wrapper metadata', () => {
    const schema = z.strictObject({
      apiKey: z.string().describe('Broker credential used for requests.'),
      timeoutSeconds: z
        .number()
        .default(30)
        .describe('Maximum wait before aborting.'),
      writeAccess: z
        .boolean()
        .describe('Allow write operations for this attachment.')
        .optional(),
    })

    expect(describeConfigSchema(schema)).toEqual([
      {
        defaultValue: undefined,
        description: 'Broker credential used for requests.',
        label: 'Api Key',
        name: 'apiKey',
        required: true,
        type: 'text',
      },
      {
        defaultValue: 30,
        description: 'Maximum wait before aborting.',
        label: 'Timeout Seconds',
        name: 'timeoutSeconds',
        required: false,
        type: 'number',
      },
      {
        defaultValue: undefined,
        description: 'Allow write operations for this attachment.',
        label: 'Write Access',
        name: 'writeAccess',
        required: false,
        type: 'boolean',
      },
    ])
  })

  test('returns an empty list for non-object schemas', () => {
    expect(describeConfigSchema(z.string())).toEqual([])
  })
})
