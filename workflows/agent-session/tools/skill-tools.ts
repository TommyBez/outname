import { tool } from 'ai'
import { z } from 'zod'
import { getSystemSandbox } from '@/lib/agent-sandbox'
import {
  createSandboxSkillTool,
  ingestGithubSkill,
  ingestMarkdownSkill,
  ingestZipSkill,
  listSandboxSkills,
} from '@/lib/skills/sandbox-skill-loader'

export function createSkillTools(agentId: string) {
  return {
    add_skill_markdown: tool({
      description:
        'Register a reusable skill by writing raw SKILL.md markdown into the sandbox-backed skill store.',
      inputSchema: z.object({
        markdown: z.string().min(1),
        slug: z.string().min(1).optional(),
      }),
      execute: async ({ markdown, slug }) => {
        'use step'
        const sandbox = await getSystemSandbox(agentId)
        return await ingestMarkdownSkill(sandbox, { markdown, slug })
      },
    }),
    add_skill_zip: tool({
      description:
        'Register a reusable skill from a ZIP archive payload (base64). ZIP extraction is path-traversal safe.',
      inputSchema: z.object({
        filename: z.string().optional(),
        zipBase64: z.string().min(1),
      }),
      execute: async ({ filename, zipBase64 }) => {
        'use step'
        const sandbox = await getSystemSandbox(agentId)
        return await ingestZipSkill(sandbox, { filename, zipBase64 })
      },
    }),
    add_skill_github: tool({
      description:
        'Register a reusable skill from a GitHub repository URL containing SKILL.md.',
      inputSchema: z.object({
        branch: z.string().optional(),
        repoUrl: z.string().url(),
      }),
      execute: async ({ repoUrl, branch }) => {
        'use step'
        const sandbox = await getSystemSandbox(agentId)
        return await ingestGithubSkill(sandbox, { branch, repoUrl })
      },
    }),
    list_skills: tool({
      description: 'List available sandbox-backed skills.',
      inputSchema: z.object({}),
      execute: async () => {
        'use step'
        const sandbox = await getSystemSandbox(agentId)
        return await listSandboxSkills(sandbox)
      },
    }),
    skill: tool({
      description:
        'Load instructions for a registered skill from the sandbox. Use this before invoking scripts with bash/file tools.',
      inputSchema: z.object({ skillName: z.string().min(1) }),
      execute: async ({ skillName }, options) => {
        'use step'
        const sandbox = await getSystemSandbox(agentId)
        const skills = await listSandboxSkills(sandbox)
        const runtimeTool = createSandboxSkillTool({ sandbox, skills })
        return await runtimeTool.execute?.({ skillName }, options)
      },
    }),
  }
}
