import { getSkillSandbox } from '@outname/ai/agent-runtime/server/agent-skill-sandbox'
import {
  discoverRuntimeSkills,
  type RuntimeSkill,
} from '@outname/ai/agent-runtime/skills/discovery'
import { db } from '@outname/db'
import { agent } from '@outname/db/schema'
import { eq } from 'drizzle-orm'

export interface SkillPlan {
  sandboxName: string | null
  skills: RuntimeSkill[]
}

export async function resolveSkillPlan(args: {
  agentId: string
}): Promise<SkillPlan> {
  'use step'
  const sandboxName = await readSkillSandboxName(args.agentId)
  if (!sandboxName) {
    return { sandboxName: null, skills: [] }
  }

  try {
    const sandbox = await getSkillSandbox(args.agentId, sandboxName)
    const skills = await discoverRuntimeSkills({ sandbox })
    return { sandboxName, skills }
  } catch (error) {
    console.warn(
      `[agent-skills] could not resolve skill sandbox for agent ${args.agentId}`,
      error
    )
    return { sandboxName, skills: [] }
  }
}

async function readSkillSandboxName(agentId: string): Promise<string | null> {
  const [row] = await db
    .select({ sandboxSkillsId: agent.sandboxSkillsId })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  return row?.sandboxSkillsId ?? null
}
