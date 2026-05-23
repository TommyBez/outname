import 'server-only'
import {
  createAgentUIStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type FinishReason,
  type ModelMessage,
  type OnFinishEvent,
  type TextStreamPart,
  type Tool,
  type UIMessage,
  type UIMessageStreamWriter,
} from 'ai'
import { nanoid } from 'nanoid'
import { revalidateTag } from 'next/cache'
import { startupSystemSandbox } from '@/agent-runtime/server/agent-sandbox'
import { cleanupRealtimeRun } from '@/agent-runtime/server/realtime-cleanup'
import {
  type AgentRuntimeSpec,
  buildAgentRuntimeSpec,
} from '@/agent-runtime/server/runtime-spec'
import { getAgentById } from '@/agent-runtime/server/start-agent-run'
import { formatBudgetExceededMessage } from '@/budgets/server/errors'
import type { ChannelId } from '@/channels/server/types'
import {
  insertChatMessageIfNew,
  persistNewChatMessages,
} from '@/chat/server/chat'
import { prepareChatMessagesForModel } from '@/chat/server/chat-model'
import { maybeGenerateConversationTitle } from '@/chat/workflows/steps/generate-conversation-title'
import { conversationListTag } from '@/shared/server/cache-tags'
import { withToolRuntimeRunId } from '@/tools/runtime/realtime-run-id'
import {
  appendStepLimitNoticeToMessages,
  appendStepLimitNoticeToOutput,
  buildStepLimitNotice,
  didReachStepLimit,
} from '../workflows/session/step-limit'
import {
  extractTotalUsage,
  preflightBudget,
  recordTokenUsageStep,
} from '../workflows/session/steps/budget'
import { buildRealtimeAgentRuntime } from './realtime-agent-runtime'

export type RealtimePersistMode = 'ui-message-full' | 'text-only'
export type RealtimeSource = 'chat' | ChannelId

export interface RealtimeDelivery {
  postAgentStream?: (stream: AsyncIterable<unknown>) => Promise<void>
  postText?: (text: string) => Promise<void>
  scheduleBackgroundTask(task: () => Promise<void>): void
}

export interface RealtimeChatTurnBaseInput {
  abortSignal: AbortSignal
  agentId: string
  conversationId: string
  delivery: RealtimeDelivery
  externalScopeId?: string
  externalThreadId?: string
  runId: string
  source: RealtimeSource
  userId: string
}

export interface RealtimeUiMessageTurnInput extends RealtimeChatTurnBaseInput {
  messages: UIMessage[]
  persistMode: 'ui-message-full'
}

export interface RealtimeTextOnlyTurnInput extends RealtimeChatTurnBaseInput {
  assistantMessageId?: string
  messages: ModelMessage[]
  persistMode: 'text-only'
  titleMessages: UIMessage[]
}

export type RealtimeChatTurnInput =
  | RealtimeUiMessageTurnInput
  | RealtimeTextOnlyTurnInput

export function runRealtimeChatTurn(
  input: RealtimeUiMessageTurnInput
): Promise<Response>
export function runRealtimeChatTurn(
  input: RealtimeTextOnlyTurnInput
): Promise<undefined>
export async function runRealtimeChatTurn(
  input: RealtimeChatTurnInput
): Promise<Response | undefined> {
  if (input.persistMode === 'ui-message-full') {
    return createRealtimeUiMessageResponse(input)
  }
  return await withToolRuntimeRunId(input.runId, async () => {
    try {
      return await runRealtimeChatTurnInsideContext(input)
    } finally {
      await cleanupRealtimeRun({ agentId: input.agentId })
    }
  })
}

function createRealtimeUiMessageResponse(
  input: RealtimeUiMessageTurnInput
): Response {
  const stream = createUIMessageStream<UIMessage>({
    async execute({ writer }) {
      await withToolRuntimeRunId(input.runId, async () => {
        try {
          await streamUiMessageTurnInsideContext({ input, writer })
        } finally {
          await cleanupRealtimeRun({ agentId: input.agentId })
        }
      })
    },
  })
  return createUIMessageStreamResponse({ stream })
}

export function tapFullStream(
  stream: AsyncIterable<TextStreamPart<Record<string, Tool>>>,
  accumulator: { text: string }
): AsyncIterable<TextStreamPart<Record<string, Tool>>> {
  return tapFullStreamGenerator(stream, accumulator)
}

async function runRealtimeChatTurnInsideContext(
  input: RealtimeTextOnlyTurnInput
): Promise<undefined> {
  const prepared = await prepareRealtimeChatTurn(input)
  if (prepared.status === 'budget-exceeded') {
    return await handleBudgetExceeded(input, prepared.notice)
  }
  await runTextOnlyTurn({ input, spec: prepared.spec })
  return
}

async function streamUiMessageTurnInsideContext(input: {
  input: RealtimeUiMessageTurnInput
  writer: UIMessageStreamWriter<UIMessage>
}): Promise<void> {
  const { input: turn } = input
  const prepared = await prepareRealtimeChatTurn(turn)
  if (prepared.status === 'budget-exceeded') {
    const message = await persistBudgetExceeded(turn, prepared.notice)
    writeAssistantNotice(input.writer, message)
    return
  }

  await streamUiMessageTurn({
    input: turn,
    spec: prepared.spec,
    writer: input.writer,
  })
}

async function prepareRealtimeChatTurn(
  input: RealtimeChatTurnInput
): Promise<
  | { status: 'ready'; spec: AgentRuntimeSpec }
  | { status: 'budget-exceeded'; notice: string }
> {
  await assertRealtimeAgentOwnership({
    agentId: input.agentId,
    userId: input.userId,
  })
  const exceeded = await preflightBudget({
    userId: input.userId,
    rootAgentId: input.agentId,
  })
  if (exceeded) {
    return {
      status: 'budget-exceeded',
      notice: formatBudgetExceededMessage(exceeded),
    }
  }
  await startupSystemSandbox({ agentId: input.agentId })
  const spec = await buildAgentRuntimeSpec({
    agentId: input.agentId,
    eventKind: 'chat',
    runId: input.runId,
  })
  if (spec.userId !== input.userId) {
    throw new Error(
      `runRealtimeChatTurn: agent ${input.agentId} does not belong to user ${input.userId}`
    )
  }
  return { status: 'ready', spec }
}

async function assertRealtimeAgentOwnership(input: {
  agentId: string
  userId: string
}): Promise<void> {
  const row = await getAgentById(input.agentId)
  if (row?.userId === input.userId) {
    return
  }
  throw new Error(
    `runRealtimeChatTurn: agent ${input.agentId} does not belong to user ${input.userId}`
  )
}

async function streamUiMessageTurn(input: {
  input: RealtimeUiMessageTurnInput
  spec: AgentRuntimeSpec
  writer: UIMessageStreamWriter<UIMessage>
}): Promise<void> {
  const { input: turn } = input
  const stepLimitInput: {
    steps: OnFinishEvent<Record<string, Tool>>['steps'] | null
  } = { steps: null }
  const built = await buildRealtimeAgentRuntime(input.spec, {
    conversationId: turn.conversationId,
    currentRunId: turn.runId,
    onFinish: (event) => {
      stepLimitInput.steps = event.steps
      scheduleUsageRecording({
        agentId: turn.agentId,
        conversationId: turn.conversationId,
        delivery: turn.delivery,
        event,
        model: input.spec.modelId,
        userId: input.spec.userId,
      })
    },
  })
  const streamMessages = prepareChatMessagesForModel(turn.messages)

  const agentStream = await createAgentUIStream({
    agent: built.agent,
    uiMessages: streamMessages,
    abortSignal: turn.abortSignal,
    // Keep the persisted transcript raw while feeding compacted historical
    // sub-agent outputs to the model. We only persist the new responseMessage.
    originalMessages: turn.messages as never,
    generateMessageId: () => `msg_${nanoid(12)}`,
    onFinish: async ({ responseMessage, isAborted, finishReason }) => {
      await handleUiMessageFinish({
        agentId: turn.agentId,
        conversationId: turn.conversationId,
        delivery: turn.delivery,
        finishReason,
        isAborted,
        responseMessage: responseMessage as UIMessage,
        stepLimitInput: {
          custom: built.meta.stepLimitCustom,
          mode: built.meta.stepLimitMode,
          steps: stepLimitInput.steps,
        },
        uiMessages: turn.messages,
      })
    },
  })
  for await (const chunk of agentStream) {
    input.writer.write(chunk as never)
  }
}

async function runTextOnlyTurn(input: {
  input: RealtimeTextOnlyTurnInput
  spec: AgentRuntimeSpec
}): Promise<void> {
  const { input: turn } = input
  if (!turn.delivery.postAgentStream) {
    throw new Error(
      'runRealtimeChatTurn: text-only delivery requires postAgentStream'
    )
  }

  const finishState: {
    event: OnFinishEvent<Record<string, Tool>> | null
  } = { event: null }
  const built = await buildRealtimeAgentRuntime(input.spec, {
    conversationId: turn.conversationId,
    currentRunId: turn.runId,
    onFinish: (event) => {
      finishState.event = event
      scheduleUsageRecording({
        agentId: turn.agentId,
        conversationId: turn.conversationId,
        delivery: turn.delivery,
        event,
        model: input.spec.modelId,
        userId: input.spec.userId,
      })
    },
  })
  const result = await built.agent.stream({
    messages: turn.messages,
    abortSignal: turn.abortSignal,
  })
  const accumulator = { text: '' }

  try {
    await turn.delivery.postAgentStream(
      tapFullStream(result.fullStream, accumulator)
    )
  } catch (err) {
    console.error('[realtime-chat] channel stream failed', {
      agentId: turn.agentId,
      conversationId: turn.conversationId,
      err,
      externalScopeId: turn.externalScopeId,
      externalThreadId: turn.externalThreadId,
      runId: turn.runId,
      source: turn.source,
    })
    throw err
  }

  let assistantText = accumulator.text.trim()
  const finishEvent = finishState.event
  if (
    finishEvent &&
    didReachStepLimit({
      custom: built.meta.stepLimitCustom,
      mode: built.meta.stepLimitMode,
      steps: finishEvent.steps,
    })
  ) {
    const notice = buildStepLimitNotice({
      custom: built.meta.stepLimitCustom,
      mode: built.meta.stepLimitMode,
    })
    await turn.delivery.postText?.(notice)
    assistantText = appendStepLimitNoticeToOutput(assistantText, notice)
  }

  if (assistantText) {
    await persistAssistantTextOnly({
      agentId: turn.agentId,
      conversationId: turn.conversationId,
      externalThreadId: turn.externalThreadId,
      id: turn.assistantMessageId ?? `msg_${nanoid(12)}`,
      runId: turn.runId,
      source: turn.source,
      text: assistantText,
    })
    scheduleTitleGeneration({
      agentId: turn.agentId,
      conversationId: turn.conversationId,
      delivery: turn.delivery,
      uiMessages: turn.titleMessages,
    })
  }
}

async function handleBudgetExceeded(
  input: RealtimeTextOnlyTurnInput,
  notice: string
): Promise<undefined> {
  await persistBudgetExceeded(input, notice)
  await input.delivery.postText?.(notice)
  return
}

async function persistBudgetExceeded(
  input: RealtimeChatTurnInput,
  notice: string
): Promise<UIMessage> {
  const assistantMessage = createAssistantTextMessage({
    id: `budget_refusal_${input.runId}`,
    text: notice,
  })
  await persistNewChatMessages({
    conversationId: input.conversationId,
    uiMessages: [assistantMessage],
  })
  revalidateTag(conversationListTag(input.agentId), 'max')
  return assistantMessage
}

function writeAssistantNotice(
  writer: UIMessageStreamWriter<UIMessage>,
  message: UIMessage
): void {
  const partId = `notice_${nanoid(8)}`
  const text = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
  writer.write({ type: 'start', messageId: message.id })
  writer.write({ type: 'text-start', id: partId })
  writer.write({ type: 'text-delta', id: partId, delta: text })
  writer.write({ type: 'text-end', id: partId })
  writer.write({ type: 'finish', finishReason: 'stop' })
}

export async function handleUiMessageFinish(input: {
  agentId: string
  conversationId: string
  delivery: RealtimeDelivery
  finishReason: FinishReason | undefined
  isAborted: boolean
  responseMessage: UIMessage
  stepLimitInput: {
    custom: number | null
    mode: Parameters<typeof buildStepLimitNotice>[0]['mode']
    steps: OnFinishEvent<Record<string, Tool>>['steps'] | null
  }
  uiMessages: UIMessage[]
}): Promise<void> {
  if (input.isAborted || input.finishReason === 'error') {
    if (input.finishReason === 'error') {
      console.error('[realtime-chat] dropping errored assistant turn', {
        agentId: input.agentId,
        conversationId: input.conversationId,
      })
    }
    return
  }

  const stepLimitSteps = input.stepLimitInput.steps
  const messages = stepLimitSteps
    ? appendStepLimitNoticeForPersistence(input.responseMessage, {
        ...input.stepLimitInput,
        steps: stepLimitSteps,
      })
    : [input.responseMessage]
  await persistNewChatMessages({
    conversationId: input.conversationId,
    uiMessages: messages,
  })
  revalidateTag(conversationListTag(input.agentId), 'max')
  scheduleTitleGeneration({
    agentId: input.agentId,
    conversationId: input.conversationId,
    delivery: input.delivery,
    uiMessages: input.uiMessages,
  })
}

function appendStepLimitNoticeForPersistence(
  responseMessage: UIMessage,
  stepLimitInput: {
    custom: number | null
    mode: Parameters<typeof buildStepLimitNotice>[0]['mode']
    steps: OnFinishEvent<Record<string, Tool>>['steps']
  }
): UIMessage[] {
  if (!didReachStepLimit(stepLimitInput)) {
    return [responseMessage]
  }
  const notice = buildStepLimitNotice(stepLimitInput)
  return appendStepLimitNoticeToMessages([responseMessage], notice)
}

async function persistAssistantTextOnly(input: {
  agentId: string
  conversationId: string
  externalThreadId?: string
  id: string
  runId: string
  source: RealtimeSource
  text: string
}): Promise<void> {
  await insertChatMessageIfNew({
    conversationId: input.conversationId,
    id: input.id,
    role: 'assistant',
    parts: [{ type: 'text', text: input.text }],
    metadata: {
      externalThreadId: input.externalThreadId ?? null,
      runId: input.runId,
      source: input.source,
    },
  })
  revalidateTag(conversationListTag(input.agentId), 'max')
}

function scheduleTitleGeneration(input: {
  agentId: string
  conversationId: string
  delivery: RealtimeDelivery
  uiMessages: UIMessage[]
}): void {
  input.delivery.scheduleBackgroundTask(async () => {
    try {
      await maybeGenerateConversationTitle({
        agentId: input.agentId,
        conversationId: input.conversationId,
        uiMessages: input.uiMessages,
      })
    } catch (err) {
      console.error('[realtime-chat] title generation failed', err)
    }
  })
}

function scheduleUsageRecording(input: {
  agentId: string
  conversationId: string
  delivery: RealtimeDelivery
  event: OnFinishEvent<Record<string, Tool>>
  model: string
  userId: string
}): void {
  input.delivery.scheduleBackgroundTask(async () => {
    try {
      await recordTokenUsageStep({
        userId: input.userId,
        agentId: input.agentId,
        rootAgentId: input.agentId,
        sourceType: 'chat',
        sourceId: input.conversationId,
        model: input.model,
        usage: extractTotalUsage(input.event),
      })
    } catch (err) {
      console.error('[realtime-chat] usage recording failed', {
        agentId: input.agentId,
        conversationId: input.conversationId,
        err,
      })
    }
  })
}

function createAssistantTextMessage(input: {
  id: string
  text: string
}): UIMessage {
  return {
    id: input.id,
    role: 'assistant',
    parts: [{ type: 'text', text: input.text }],
  }
}

async function* tapFullStreamGenerator(
  stream: AsyncIterable<TextStreamPart<Record<string, Tool>>>,
  accumulator: { text: string }
): AsyncGenerator<TextStreamPart<Record<string, Tool>>, void, unknown> {
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') {
      accumulator.text += chunk.text
    }
    yield chunk
  }
}
