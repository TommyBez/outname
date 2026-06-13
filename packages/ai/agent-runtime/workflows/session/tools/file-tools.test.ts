import { expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createFileTools } from './file-tools'

test('createFileTools exposes the full sandbox file toolset by default', () => {
  const tools = createFileTools({ agentId: 'agent_123' })

  expect(Object.keys(tools).sort()).toEqual([
    'grepFiles',
    'listFiles',
    'readFile',
    'writeFile',
  ])
})
