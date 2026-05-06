import {
  createAgentUIStreamResponse,
  stepCountIs,
  ToolLoopAgent,
  tool,
  type UIMessage,
} from 'ai'
import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { updateAgentAction } from '@/lib/agent-actions'
import { auth } from '@/lib/auth'
import { getAgentByIdForUser, getAgentMemoryFile } from '@/lib/data'
import { db } from '@/lib/db'
import { pendingFileWrites } from '@/lib/db/schema'

const EDIT_MODEL = 'deepseek/deepseek-v4-flash'

const updateSchema = z.object({
  name: z.string().min(1),
  model: z.string().min(1),
  heartbeatEnabled: z.boolean(),
  heartbeatIntervalMinutes: z.number().int().min(5).max(1440),
  reflectionEnabled: z.boolean(),
  reflectionIntervalMinutes: z.number().int().min(5).max(1440),
  stepLimitMode: z.enum(['custom', 'grind', 'high', 'low', 'medium']),
  stepLimitCustom: z.number().int().min(1).nullable(),
  identityCard: z.string(),
  soul: z.string(),
  instructions: z.string(),
  userProfile: z.string(),
})

export async function POST(
  req: Request,
  ctx: { params: Promise<{ agentId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { agentId } = await ctx.params
  const existing = await getAgentByIdForUser(agentId, session.user.id)
  if (!existing) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  let body: { messages?: UIMessage[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  const agent = new ToolLoopAgent({
    model: EDIT_MODEL,
    stopWhen: stepCountIs(8),
    instructions:
      'You are an agent editing assistant. Ask concise questions, summarize planned edits, then call apply_agent_edit. Do not apply changes until complete.',
    tools: {
      get_current_agent_config: tool({
        description: 'Get current editable agent configuration.',
        inputSchema: z.object({}),
        execute: async () => getCurrent(agentId, session.user.id),
      }),
      apply_agent_edit: tool({
        description: 'Apply the final edit after user approval.',
        inputSchema: updateSchema,
        needsApproval: true,
        execute: async (input) => {
          const current = await getCurrent(agentId, session.user.id)
          await updateAgentAction({
            id: agentId,
            ...input,
            identityCardOriginal: current.identityCard,
            soulOriginal: current.soul,
            instructionsOriginal: current.instructions,
            userProfileOriginal: current.userProfile,
          })
          return { ok: true, agentId }
        },
      }),
    },
  })

  return createAgentUIStreamResponse({ agent, uiMessages: body.messages })
}

async function getCurrent(agentId: string, userId: string) {
  const agentRow = await getAgentByIdForUser(agentId, userId)
  if (!agentRow) {
    throw new Error('Not found')
  }
  const [identityCard, soul, instructions, userProfile] = await Promise.all([
    resolveBootstrap(agentId, 'IDENTITY.md'),
    resolveBootstrap(agentId, 'SOUL.md'),
    resolveBootstrap(agentId, 'AGENTS.md'),
    resolveBootstrap(agentId, 'USER.md'),
  ])
  return {
    name: agentRow.name,
    model: agentRow.model,
    heartbeatEnabled: agentRow.heartbeatEnabled,
    heartbeatIntervalMinutes: agentRow.heartbeatIntervalMinutes,
    reflectionEnabled: agentRow.reflectionEnabled,
    reflectionIntervalMinutes: agentRow.reflectionIntervalMinutes,
    stepLimitMode: (agentRow.stepLimitMode ?? 'medium') as
      | 'custom'
      | 'grind'
      | 'high'
      | 'low'
      | 'medium',
    stepLimitCustom: agentRow.stepLimitCustom,
    identityCard,
    soul,
    instructions,
    userProfile,
  }
}

async function resolveBootstrap(agentId: string, path: string) {
  const [latest] = await db
    .select()
    .from(pendingFileWrites)
    .where(
      and(
        eq(pendingFileWrites.agentId, agentId),
        eq(pendingFileWrites.path, path)
      )
    )
    .orderBy(desc(pendingFileWrites.enqueuedAt))
    .limit(1)
  if (latest) {
    return latest.content
  }
  const file = await getAgentMemoryFile({ agentId, path })
  return file?.content ?? ''
}
