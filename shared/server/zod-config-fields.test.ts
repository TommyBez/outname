import { expect, test, vi } from 'vitest'
import { z } from 'zod'

vi.mock('server-only', () => ({}))

import { describeConfigSchema } from './zod-config-fields'

test('describeConfigSchema extracts v4 object fields and wrapper metadata', () => {
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

test('describeConfigSchema returns an empty list for non-object schemas', () => {
  expect(describeConfigSchema(z.string())).toEqual([])
})
