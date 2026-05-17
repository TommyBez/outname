import { expect, test } from 'vitest'
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

test('createFileTools can disable runCommand-backed tools for invocation runs', () => {
  const tools = createFileTools(
    { agentId: 'agent_123' },
    {
      grepFiles: false,
      listFiles: false,
      writeFile: false,
    }
  )

  expect(Object.keys(tools)).toEqual(['readFile'])
})
