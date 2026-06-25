import 'server-only'
import { db } from '@outname/db'
import { agent } from '@outname/db/schema'
import { withVercelSandboxCredentials } from '@outname/shared/server/vercel-sandbox-config'
import type { Sandbox } from '@vercel/sandbox'
import { eq } from 'drizzle-orm'

type AgentSandboxField = 'sandboxSkillsId' | 'sandboxSystemId'

export function createAgentSandboxAccessor(input: {
  field: AgentSandboxField
  missingMessage: (agentId: string) => string
  suffix: string
}) {
  const nameFor = (agentId: string): string =>
    `agent-${agentId}-${input.suffix}`

  const isMissingSandboxError = (error: unknown, agentId: string): boolean =>
    error instanceof Error && error.message === input.missingMessage(agentId)

  const readSandboxId = async (agentId: string): Promise<string | null> => {
    const [row] = await db
      .select({
        sandboxId: agent[input.field],
      })
      .from(agent)
      .where(eq(agent.id, agentId))
      .limit(1)
    return row?.sandboxId ?? null
  }

  const writeSandboxId = async (
    agentId: string,
    sandboxId: string
  ): Promise<void> => {
    await db
      .update(agent)
      .set({
        [input.field]: sandboxId,
        updatedAt: new Date(),
      })
      .where(eq(agent.id, agentId))
  }

  const getSandbox = async (
    agentId: string,
    sandboxName?: string
  ): Promise<Sandbox> => {
    const { Sandbox } = await import('@vercel/sandbox')
    const name = sandboxName ?? (await readSandboxId(agentId))
    if (!name) {
      throw new Error(input.missingMessage(agentId))
    }
    return Sandbox.get(withVercelSandboxCredentials({ name, resume: true }))
  }

  const destroySandbox = async (agentId: string): Promise<void> => {
    const name = await readSandboxId(agentId)
    if (!name) {
      return
    }
    try {
      const { Sandbox } = await import('@vercel/sandbox')
      const sandbox = await Sandbox.get(
        withVercelSandboxCredentials({ name, resume: false })
      )
      await sandbox.delete()
    } catch {
      /* already gone or unreachable */
    }
  }

  return {
    destroySandbox,
    getSandbox,
    isMissingSandboxError,
    nameFor,
    readSandboxId,
    writeSandboxId,
  }
}
