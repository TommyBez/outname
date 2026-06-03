import { auth } from '@outname/auth/server/auth'
import {
  getRequiredDefaultInferenceProvider,
  getUserLanguageModel,
  listEnabledInferenceProviders,
} from '@outname/shared/server/inference-providers'
import {
  createAgentUIStreamResponse,
  stepCountIs,
  ToolLoopAgent,
  tool,
  type UIMessage,
} from 'ai'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listAvailableTools } from './available-tools'
import { createRequestedAgent } from './create-requested-agent'
import { CREATOR_MODEL, creatorInstructions } from './instructions'
import { createAgentInputSchema, proposeBudgetInputSchema } from './schemas'

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const messages = await readMessages(req)
  if (!messages.ok) {
    return messages.response
  }

  const [enabledProviders, inferenceProvider] = await Promise.all([
    listEnabledInferenceProviders(session.user.id),
    getRequiredDefaultInferenceProvider(session.user.id),
  ])
  const model = await getUserLanguageModel({
    inferenceProvider,
    modelId: CREATOR_MODEL,
    userId: session.user.id,
  })

  const agent = new ToolLoopAgent({
    model,
    instructions: creatorInstructions({ enabledProviders }),
    stopWhen: stepCountIs(8),
    tools: {
      list_available_tools: tool({
        description:
          'List maintainer tools, tool config requirements, user connections, and attachable sub-agents before suggesting tools.',
        inputSchema: z.object({}),
        execute: async () => listAvailableTools(session.user.id),
      }),
      propose_agent_budget: tool({
        description:
          'Propose USD spend caps for the new agent across daily/weekly/monthly windows. The UI renders an editable widget with these defaults and the user submits the values they want. After this returns, use the values from the resulting tool message (echoed in proposed.*) and any user follow-up message as the budget for create_requested_agent.',
        inputSchema: proposeBudgetInputSchema,
        execute: async (input) => ({
          proposed: {
            daily: input.daily,
            weekly: input.weekly,
            monthly: input.monthly,
          },
          rationale: input.rationale,
        }),
      }),
      create_requested_agent: tool({
        description:
          'Create the reviewed agent after the user approves the final configuration. This mutates the database, attaches selected tools, and persists the per-agent budget rules.',
        inputSchema: createAgentInputSchema,
        needsApproval: true,
        execute: async (input, options) =>
          createRequestedAgent({
            input,
            toolCallId: options.toolCallId,
            userId: session.user.id,
          }),
      }),
    },
  })

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages.value,
  })
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
