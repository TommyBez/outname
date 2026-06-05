import { expect, test, vi } from 'vitest'

vi.mock('@outname/ai/agent-runtime/server/agent-skill-sandbox', () => ({
  getSkillSandbox: vi.fn(),
}))

import { createSkillTools } from './skill-tools'

test('createSkillTools exposes no tools without runtime skills', () => {
  expect(
    Object.keys(
      createSkillTools({
        agentId: 'agent_123',
        skillPlan: { sandboxName: null, skills: [] },
      })
    )
  ).toEqual([])
})

test('createSkillTools exposes skill and bash when runtime skills exist', () => {
  const tools = createSkillTools({
    agentId: 'agent_123',
    skillPlan: {
      sandboxName: 'agent-agent_123-skills',
      skills: [
        {
          description: 'Stress-test a plan.',
          name: 'Grill With Docs',
          nameNormalized: 'grill with docs',
          path: '/vercel/sandbox/skills/grill-with-docs',
          skillMdPath: '/vercel/sandbox/skills/grill-with-docs/SKILL.md',
          slug: 'grill-with-docs',
        },
      ],
    },
  })

  expect(Object.keys(tools).sort()).toEqual(['bash', 'skill'])
})
