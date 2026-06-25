import { ensureToolSandboxBuild } from '@outname/ai/tools/sandboxes/builds/build'
import { detachToolForUser } from '@outname/ai/tools/server/attachment-service/detach'
import { attachMaintainerToolForUser } from '@outname/ai/tools/server/attachment-service/maintainer'
import { attachSubAgentForUser } from '@outname/ai/tools/server/attachment-service/sub-agent'
import { auth } from '@outname/auth/server/auth'
import { updateAgentForUser } from '@outname/shared/agents/server/update-service'
import { revalidateAppAfter } from '@outname/shared/server/app-revalidation-after'
import {
  agentTag,
  agentToolsTag,
  userAgentsTag,
} from '@outname/shared/server/cache-tags'
import { getAgentByIdForUser } from '@outname/shared/server/data'
import {
  getRequiredDefaultInferenceProvider,
  getUserLanguageModel,
} from '@outname/shared/server/inference-providers'
import {
  createAgentUIStreamResponse,
  isStepCount,
  ToolLoopAgent,
  tool,
  type UIMessage,
} from 'ai'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  applyAgentBudget,
  loadAgentBudget,
  revalidateAgentEditSurfaces,
} from './budget-tools'
import { getCurrent } from './current-config'
import {
  attachMaintainerToolSchema,
  attachSubAgentToolSchema,
  detachToolSchema,
  proposeBudgetInputSchema,
  setBudgetSchema,
  updateSchema,
} from './schemas'
import {
  buildEditInstructions,
  getAvailableAgentTools,
} from './tool-visibility'

const EDIT_MODEL = 'deepseek/deepseek-v4-flash'

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

  const messages = await readMessages(req)
  if (!messages.ok) {
    return messages.response
  }

  const inferenceProvider = await getRequiredDefaultInferenceProvider(
    session.user.id
  )
  const [model, toolVisibility] = await Promise.all([
    getUserLanguageModel({
      inferenceProvider,
      modelId: EDIT_MODEL,
      userId: session.user.id,
    }),
    getAvailableAgentTools(agentId, session.user.id),
  ])
  const agent = new ToolLoopAgent({
    model,
    stopWhen: isStepCount(8),
    instructions: buildEditInstructions(toolVisibility),
    toolApproval: {
      apply_agent_edit: 'user-approval',
      attach_maintainer_tool: 'user-approval',
      attach_sub_agent_tool: 'user-approval',
      detach_agent_tool: 'user-approval',
      set_agent_budget: 'user-approval',
    },
    tools: buildEditTools({ agentId, userId: session.user.id }),
  })

  return createAgentUIStreamResponse({ agent, uiMessages: messages.value })
}

function buildEditTools(input: { agentId: string; userId: string }) {
  const { agentId, userId } = input
  return {
    get_current_agent_config: tool({
      description:
        'Get current editable agent configuration, including attached and available tools.',
      inputSchema: z.object({}),
      execute: async () => {
        const [current, tools] = await Promise.all([
          getCurrent(agentId, userId),
          getAvailableAgentTools(agentId, userId),
        ])
        return { ...current, tools }
      },
    }),
    get_available_agent_tools: tool({
      description:
        'List maintainer tools, current tool attachments, connector connection states, and attachable sub-agents.',
      inputSchema: z.object({}),
      execute: async () => getAvailableAgentTools(agentId, userId),
    }),
    apply_agent_edit: tool({
      description: 'Apply the final edit after user approval.',
      inputSchema: updateSchema,
      execute: async (edit) => {
        const current = await getCurrent(agentId, userId)
        await updateAgentForUser({
          id: agentId,
          ...edit,
          identityCardOriginal: current.identityCard,
          soulOriginal: current.soul,
          instructionsOriginal: current.instructions,
          userProfileOriginal: current.userProfile,
          userId,
        })
        revalidateAgentEditSurfaces(agentId, userId)
        return { ok: true, agentId }
      },
    }),
    attach_maintainer_tool: tool({
      description:
        'Attach or update a maintainer tool on this agent after user approval. Use get_available_agent_tools first so you know the required config fields.',
      inputSchema: attachMaintainerToolSchema,
      execute: async (edit) => {
        const result = await attachMaintainerToolForUser({
          agentId,
          ensureSandboxBuild: ensureToolSandboxBuild,
          toolId: edit.toolId,
          rawConfig: edit.config ?? {},
          userId,
        })
        if (result.ok) {
          revalidateToolSurfaces(agentId, userId)
        }
        return result
      },
    }),
    attach_sub_agent_tool: tool({
      description:
        'Attach one of the user-owned agents as a callable sub-agent tool after user approval.',
      inputSchema: attachSubAgentToolSchema,
      execute: async (edit) => {
        const result = await attachSubAgentForUser({
          parentAgentId: agentId,
          childAgentId: edit.childAgentId,
          userId,
        })
        if (result.ok) {
          revalidateToolSurfaces(agentId, userId)
        }
        return result
      },
    }),
    detach_agent_tool: tool({
      description:
        'Detach a maintainer or sub-agent tool from this agent after user approval. Use the exact attached toolId from get_available_agent_tools.',
      inputSchema: detachToolSchema,
      execute: async (edit) => {
        const result = await detachToolForUser({
          agentId,
          toolId: edit.toolId,
          kind: edit.kind,
          userId,
        })
        if (result.ok) {
          revalidateToolSurfaces(agentId, userId)
        }
        return result
      },
    }),
    get_agent_budget: tool({
      description:
        'Read the current per-agent USD spend caps before proposing a change.',
      inputSchema: z.object({}),
      execute: async () => loadAgentBudget(agentId, userId),
    }),
    propose_agent_budget: tool({
      description:
        'Propose USD spend caps for this agent. The UI renders an editable widget with these values; the operator adjusts and submits. Wait for the user follow-up message before calling set_agent_budget.',
      inputSchema: proposeBudgetInputSchema,
      execute: async (edit) => ({
        proposed: {
          daily: edit.daily,
          weekly: edit.weekly,
          monthly: edit.monthly,
        },
        rationale: edit.rationale,
      }),
    }),
    set_agent_budget: tool({
      description:
        'Persist the per-agent USD spend caps after user approval. Pass `null` for any period to clear that cap. Use the values the user confirmed via propose_agent_budget.',
      inputSchema: setBudgetSchema,
      execute: async (edit) => {
        const result = await applyAgentBudget({ agentId, userId, ...edit })
        revalidateAgentEditSurfaces(agentId, userId)
        return result
      },
    }),
  }
}

function revalidateToolSurfaces(agentId: string, userId: string): void {
  revalidateAppAfter([
    [agentToolsTag(agentId), 'max'],
    [agentTag(agentId), 'max'],
    [userAgentsTag(userId), 'max'],
  ])
}

async function readMessages(
  req: Request
): Promise<
  | { ok: true; value: UIMessage[] }
  | { ok: false; response: ReturnType<typeof NextResponse.json> }
> {
  let body: { messages?: UIMessage[] }
  try {
    body = await req.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'invalid json' }, { status: 400 }),
    }
  }
  if (!Array.isArray(body.messages)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'messages required' },
        { status: 400 }
      ),
    }
  }
  return { ok: true, value: body.messages }
}
