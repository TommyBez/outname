'use client'

import type {
  AgentChatMessage,
  WorkflowStatusData,
} from '@outname/ai/agent-runtime/server/chat-status'
import { AgentChatTranscript } from '@outname/ai/chat/components/agent-chat-transcript'
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@outname/ai/components/ai-elements/prompt-input'
import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import { Button } from '@outname/ui/components/ui/button'
import { cn } from '@outname/ui/lib/utils'
import { BotIcon, ChevronRightIcon, CircleIcon } from 'lucide-react'
import {
  domAnimation,
  LazyMotion,
  m as motion,
  useReducedMotion,
} from 'motion/react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

interface ChatShowcaseScenario {
  description: string
  id: 'triage' | 'research' | 'digest'
  messages: AgentChatMessage[]
  model: string
  prompt: string
  relativeTime: string
  status: WorkflowStatusData
  title: string
}

const agentMeta = {
  attached: '3 tools · 1 sub-agent · 2 channels',
  defaultModel: 'claude-sonnet-4-6',
  name: 'INBOX SENTINEL',
}

const showcaseScenarios: readonly ChatShowcaseScenario[] = [
  {
    description:
      'Reads Slack + email overnight, drafts replies, surfaces calendar conflicts to confirm.',
    id: 'triage',
    model: agentMeta.defaultModel,
    prompt: 'Check the morning queue and prep what needs my attention.',
    relativeTime: '2m ago',
    status: {
      message: 'Resolving attached tools…',
      phase: 'agent-event',
      timestamp: '2026-05-13T07:30:00.000Z',
    },
    title: 'Morning triage',
    messages: [
      {
        id: 'triage-user',
        parts: [
          {
            text: 'Check the morning queue and prep what needs my attention.',
            type: 'text',
          },
        ],
        role: 'user',
      },
      {
        id: 'triage-assistant',
        parts: [
          {
            state: 'done',
            text: 'I should scan Slack first since the team posts overnight, then cross-check the calendar for any conflict before 10:00. I will hold off on email until both signals are in.',
            type: 'reasoning',
          },
          {
            input: {
              channel: '#ops',
              includeThreads: true,
              since: 'today 06:00',
            },
            output: {
              channel: '#ops',
              flagged: 2,
              threads: 14,
            },
            state: 'output-available',
            toolCallId: 'triage-slack',
            toolName: 'slack.search_threads',
            type: 'dynamic-tool',
          },
          {
            input: {
              from: '2026-05-13T09:00',
              to: '2026-05-13T18:00',
            },
            output: {
              conflicts: [
                {
                  at: 'tue 15:00',
                  suggested: 'wed 10:00',
                  with: 'Design review',
                },
              ],
            },
            state: 'output-available',
            toolCallId: 'triage-cal',
            toolName: 'cal.find_conflicts',
            type: 'dynamic-tool',
          },
          {
            text: 'Three items need you. Two flagged Slack threads in #ops (engineering blocker + customer reply). One calendar conflict at 15:00 with Design review — I drafted a reschedule to wed 10:00, awaiting your confirm.',
            type: 'text',
          },
        ],
        role: 'assistant',
      },
    ],
  },
  {
    description:
      'Delegates synthesis to a specialist sub-agent. Parent waits and surfaces the child trace inline.',
    id: 'research',
    model: agentMeta.defaultModel,
    prompt: "Compare today's product feedback with last week's notes.",
    relativeTime: '14m ago',
    status: {
      message: 'Calling sub-agent: research-synthesizer',
      phase: 'agent-stream',
      timestamp: '2026-05-13T07:16:00.000Z',
    },
    title: 'Research relay',
    messages: [
      {
        id: 'research-user',
        parts: [
          {
            text: "Compare today's product feedback with last week's notes.",
            type: 'text',
          },
        ],
        role: 'user',
      },
      {
        id: 'research-assistant',
        parts: [
          {
            state: 'done',
            text: 'This is comparative work across two sources — better to hand to research-synthesizer than do it inline. I will pass both windows and let it return a structured summary.',
            type: 'reasoning',
          },
          {
            input: {
              agent: 'research-synthesizer',
              task: 'Compare today vs last week. Surface recurring asks and sentiment shifts.',
              windows: ['2026-05-13', '2026-05-06..2026-05-12'],
            },
            output: {
              childAgentId: 'research-synthesizer',
              childName: 'research-synthesizer',
              finalText:
                'Recurring asks: composability (8/12 mentions, up from 5/12) and audit trails (4/12, flat). Sentiment up on private deployment, down on onboarding length.',
              kind: 'sub_agent',
              messages: [
                {
                  id: 'sub-research-1',
                  parts: [
                    {
                      text: 'Loading both feedback windows from the memory mirror.',
                      type: 'text',
                    },
                  ],
                  role: 'assistant',
                },
                {
                  id: 'sub-research-2',
                  parts: [
                    {
                      input: { window: '2026-05-06..2026-05-12' },
                      output: { entries: 12, sentiment: 'mixed' },
                      state: 'output-available',
                      toolCallId: 'sub-research-mem',
                      toolName: 'memory.read',
                      type: 'dynamic-tool',
                    },
                    {
                      text: 'Comparison done. 8/12 mentions point to composability — up from 5/12 last week.',
                      type: 'text',
                    },
                  ],
                  role: 'assistant',
                },
              ],
              status: 'completed',
              toolName: 'agent_research_synthesizer',
            },
            state: 'output-available',
            toolCallId: 'research-subagent',
            toolName: 'agent_research_synthesizer',
            type: 'dynamic-tool',
          },
          {
            text: 'Composability is the strongest repeated request this week (8 of 12 mentions, up from 5). Sentiment is up on private deployment and down on onboarding length. Full trace in the sub-agent step above.',
            type: 'text',
          },
        ],
        role: 'assistant',
      },
    ],
  },
  {
    description:
      'Heartbeat-fired weekly run. Appends to memory, drafts the digest, sends it. No human prompt.',
    id: 'digest',
    model: agentMeta.defaultModel,
    prompt: '(heartbeat) Prepare and send the weekly digest.',
    relativeTime: 'yesterday',
    status: {
      message: 'Saving sandbox memory…',
      phase: 'agent-stream',
      timestamp: '2026-05-12T14:00:00.000Z',
    },
    title: 'Weekly digest',
    messages: [
      {
        id: 'digest-user',
        parts: [
          {
            text: '(heartbeat) Prepare and send the weekly digest.',
            type: 'text',
          },
        ],
        role: 'user',
      },
      {
        id: 'digest-assistant',
        parts: [
          {
            state: 'done',
            text: 'No human in the loop right now — heartbeat fired this run. I will append three lines to DREAMS.md, draft the digest email, and send it to myself.',
            type: 'reasoning',
          },
          {
            input: {
              append:
                '+ Follow up on channel bindings\n+ Validate webhook intake design\n+ Reduce onboarding to 3 steps',
              file: 'DREAMS.md',
            },
            output: {
              appended: 3,
              file: 'DREAMS.md',
              status: 'committed',
            },
            state: 'output-available',
            toolCallId: 'digest-mem',
            toolName: 'memory.append',
            type: 'dynamic-tool',
          },
          {
            input: {
              subject: 'Week of May 4 — composability is the recurring ask',
              to: 'self',
            },
            output: {
              draftId: 'd_8f12',
              status: 'drafted',
            },
            state: 'output-available',
            toolCallId: 'digest-gmail',
            toolName: 'gmail.draft',
            type: 'dynamic-tool',
          },
          {
            input: {
              draftId: 'd_8f12',
            },
            output: {
              messageId: 'm_a01c',
              status: 'sent',
            },
            state: 'output-available',
            toolCallId: 'digest-send',
            toolName: 'gmail.send',
            type: 'dynamic-tool',
          },
          {
            text: 'Digest sent (m_a01c). Three lines appended to DREAMS.md. Ready for you in the morning.',
            type: 'text',
          },
        ],
        role: 'assistant',
      },
    ],
  },
]

interface Frame {
  delayBefore: number
  messages: AgentChatMessage[]
  workflowStatus: WorkflowStatusData | null
}

function cloneMessages(messages: AgentChatMessage[]): AgentChatMessage[] {
  return messages.map((m) => ({ ...m, parts: m.parts.map((p) => ({ ...p })) }))
}

function buildFrames(scenario: ChatShowcaseScenario): Frame[] {
  const frames: Frame[] = []
  const currentMessages: AgentChatMessage[] = []

  for (const message of scenario.messages) {
    if (message.role === 'user') {
      currentMessages.push({ ...message, parts: [...message.parts] })
      frames.push({
        delayBefore: frames.length === 0 ? 200 : 700,
        messages: cloneMessages(currentMessages),
        workflowStatus: null,
      })
      continue
    }

    // Assistant: emit workflow status before any content
    frames.push({
      delayBefore: 600,
      messages: cloneMessages(currentMessages),
      workflowStatus: scenario.status,
    })

    // Start with empty assistant shell
    currentMessages.push({ ...message, parts: [] })
    const assistantIdx = currentMessages.length - 1

    for (const part of message.parts) {
      const last = currentMessages[assistantIdx]
      if (part.type === 'dynamic-tool') {
        // First emit running state
        const runningPart = {
          input: part.input,
          state: 'input-available' as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          type: 'dynamic-tool' as const,
        }
        currentMessages[assistantIdx] = {
          ...last,
          parts: [...last.parts, runningPart],
        }
        frames.push({
          delayBefore: 650,
          messages: cloneMessages(currentMessages),
          workflowStatus: scenario.status,
        })

        // Promote to completed (full part)
        const finalParts = [...currentMessages[assistantIdx].parts]
        finalParts[finalParts.length - 1] = { ...part }
        currentMessages[assistantIdx] = {
          ...currentMessages[assistantIdx],
          parts: finalParts,
        }
        frames.push({
          delayBefore: 700,
          messages: cloneMessages(currentMessages),
          workflowStatus: scenario.status,
        })
      } else {
        // reasoning, text, anything else: append intact
        currentMessages[assistantIdx] = {
          ...last,
          parts: [...last.parts, part],
        }
        frames.push({
          delayBefore: 700,
          messages: cloneMessages(currentMessages),
          workflowStatus: scenario.status,
        })
      }
    }

    // Clear workflow status as final frame for this assistant turn
    frames.push({
      delayBefore: 250,
      messages: cloneMessages(currentMessages),
      workflowStatus: null,
    })
  }

  return frames
}

const framesByScenario = new Map<string, Frame[]>()
for (const scenario of showcaseScenarios) {
  framesByScenario.set(scenario.id, buildFrames(scenario))
}

const EMPTY_FRAMES: readonly Frame[] = []
const EMPTY_FRAME: Frame = {
  delayBefore: 0,
  messages: [],
  workflowStatus: null,
}

interface ShowcaseState {
  activeId: ChatShowcaseScenario['id']
  frameIndex: number
  input: string
  isPlaying: boolean
}

type ShowcaseAction =
  | { type: 'input'; value: string }
  | { type: 'play' }
  | { scenario: ChatShowcaseScenario; type: 'select-scenario' }
  | { frameIndex: number; type: 'show-frame' }
  | { type: 'stop' }

const initialShowcaseState: ShowcaseState = {
  activeId: showcaseScenarios[0].id,
  frameIndex: 0,
  input: showcaseScenarios[0].prompt,
  isPlaying: false,
}

function showcaseReducer(
  state: ShowcaseState,
  action: ShowcaseAction
): ShowcaseState {
  switch (action.type) {
    case 'input':
      return { ...state, input: action.value }
    case 'play':
      return { ...state, frameIndex: 0, isPlaying: true }
    case 'select-scenario':
      return {
        ...state,
        activeId: action.scenario.id,
        frameIndex: 0,
        input: action.scenario.prompt,
        isPlaying: true,
      }
    case 'show-frame':
      return { ...state, frameIndex: action.frameIndex }
    case 'stop':
      return { ...state, isPlaying: false }
    default:
      return state
  }
}

export function LandingChatShowcase({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  const reduceMotion = useReducedMotion()
  const reduceMotionFlag = shouldReduceMotion || Boolean(reduceMotion)

  const [state, dispatch] = useReducer(showcaseReducer, initialShowcaseState)
  const { activeId, frameIndex, input, isPlaying } = state
  const hasAutoPlayedRef = useRef(false)
  const sectionRef = useRef<HTMLElement | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeScenario = useMemo(
    () =>
      showcaseScenarios.find((scenario) => scenario.id === activeId) ??
      showcaseScenarios[0],
    [activeId]
  )
  const frames = framesByScenario.get(activeScenario.id) ?? EMPTY_FRAMES
  const totalFrames = frames.length
  const currentFrame =
    frames[Math.min(frameIndex, totalFrames - 1)] ?? EMPTY_FRAME

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const play = useCallback(() => {
    clearTimer()
    dispatch({ type: 'play' })
  }, [clearTimer])

  // Animation tick: schedule next frame based on its delay.
  useEffect(() => {
    if (reduceMotionFlag || !isPlaying) {
      return
    }
    if (frameIndex >= totalFrames - 1) {
      dispatch({ type: 'stop' })
      return
    }
    const nextIndex = frameIndex + 1
    const delay = frames[nextIndex]?.delayBefore ?? 600
    const timeoutId = setTimeout(() => {
      dispatch({ frameIndex: nextIndex, type: 'show-frame' })
    }, delay)
    timeoutRef.current = timeoutId
    return () => {
      clearTimeout(timeoutId)
      if (timeoutRef.current === timeoutId) {
        timeoutRef.current = null
      }
    }
  }, [frameIndex, frames, isPlaying, reduceMotionFlag, totalFrames])

  // Auto-play once when section enters viewport.
  useEffect(() => {
    if (reduceMotionFlag || hasAutoPlayedRef.current) {
      return
    }
    const section = sectionRef.current
    if (!section || typeof IntersectionObserver === 'undefined') {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            hasAutoPlayedRef.current = true
            play()
            observer.disconnect()
            break
          }
        }
      },
      { threshold: 0.35 }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [play, reduceMotionFlag])

  function handleScenarioSelect(scenario: ChatShowcaseScenario) {
    clearTimer()
    dispatch({ scenario, type: 'select-scenario' })
  }

  const displayMessages = reduceMotionFlag
    ? activeScenario.messages
    : currentFrame.messages
  const displayStatus = reduceMotionFlag ? null : currentFrame.workflowStatus

  return (
    <section
      className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12"
      id="chat"
      ref={sectionRef}
    >
      <LazyMotion features={domAnimation}>
        <motion.div
          className="mx-auto max-w-7xl"
          initial={reduceMotionFlag ? false : 'hidden'}
          variants={staggerVariants}
          viewport={{ once: true, margin: '-80px' }}
          whileInView="visible"
        >
          <motion.div
            className="grid gap-5 border-border border-t-4 pt-5 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] md:items-end"
            variants={revealVariants}
          >
            <div>
              <p className="swiss-label text-brand">Live agent · /chat/:id</p>
              <h2 className="mt-4 text-balance font-black text-5xl uppercase leading-[0.88] tracking-normal md:text-7xl">
                Same agent. Every surface.
              </h2>
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              Heartbeat runs, in-app chat, Slack, Discord, Telegram.
            </p>
          </motion.div>

          <motion.div
            className="mt-8 border border-border bg-background p-2"
            variants={revealVariants}
          >
            <div className="grid min-h-[32rem] border border-border/15 bg-background lg:min-h-[44rem] lg:grid-cols-[18rem_minmax(0,1fr)]">
              <aside className="min-w-0 border-border border-b bg-muted lg:flex lg:flex-col lg:border-r lg:border-b-0">
                <div className="flex items-center justify-between gap-3 border-border border-b p-3 lg:block lg:p-5">
                  <div className="flex min-w-0 items-center gap-3 lg:block">
                    <span className="grid size-9 shrink-0 place-items-center border border-border bg-brand lg:hidden">
                      <BotIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="hidden font-bold text-[10px] text-muted-foreground uppercase tracking-normal lg:block">
                        Workspace
                      </p>
                      <div className="lg:mt-3 lg:flex lg:items-start lg:justify-between lg:gap-3">
                        <div className="min-w-0">
                          <p className="font-black text-sm uppercase leading-none tracking-normal lg:text-lg">
                            {agentMeta.name}
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-normal lg:mt-2">
                            {agentMeta.attached}
                          </p>
                        </div>
                        <span className="hidden size-9 shrink-0 place-items-center border border-border bg-brand lg:grid">
                          <BotIcon className="size-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <nav className="hidden border-border border-b p-3 lg:block">
                  <ul className="grid gap-0.5 font-mono text-[11px] uppercase tracking-normal">
                    {[
                      { active: true, label: 'Chat' },
                      { active: false, label: 'Configure' },
                      { active: false, label: 'Memory' },
                      { active: false, label: 'Tools' },
                      { active: false, label: 'Timeline' },
                    ].map((item) => (
                      <li key={item.label}>
                        <span
                          className={cn(
                            'flex items-center justify-between gap-2 px-3 py-2',
                            item.active
                              ? 'bg-foreground text-background'
                              : 'text-muted-foreground'
                          )}
                        >
                          {item.label}
                          {item.active ? (
                            <ChevronRightIcon className="size-3" />
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </nav>

                <div className="min-w-0 border-border border-b p-2 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:border-b-0 lg:p-3">
                  <p className="hidden px-2 pt-1 pb-2 font-bold text-[10px] text-muted-foreground uppercase tracking-normal lg:block">
                    Conversations
                  </p>
                  <ul className="-mx-2 flex gap-1.5 overflow-x-auto px-2 lg:mx-0 lg:grid lg:gap-1.5 lg:overflow-visible lg:px-0">
                    {showcaseScenarios.map((scenario) => (
                      <li className="shrink-0 lg:shrink" key={scenario.id}>
                        <Button
                          className={cn(
                            'ease grid h-full w-44 items-stretch justify-normal gap-1 border border-border px-3 py-2 text-left font-normal normal-case tracking-normal transition-colors duration-150 lg:w-full lg:px-3 lg:py-2.5',
                            activeScenario.id === scenario.id
                              ? 'bg-background'
                              : 'bg-muted hover:bg-background'
                          )}
                          onClick={() => handleScenarioSelect(scenario)}
                          size="xs"
                          type="button"
                          variant="ghost"
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-black text-xs uppercase tracking-normal">
                              {scenario.title}
                            </span>
                            <span className="shrink-0 font-mono text-[9px] text-muted-foreground uppercase tracking-normal">
                              {scenario.relativeTime}
                            </span>
                          </span>
                          <span className="line-clamp-2 hidden whitespace-normal text-[11px] text-muted-foreground leading-snug lg:block">
                            {scenario.description}
                          </span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>

              <div className="flex min-w-0 flex-col">
                <header className="flex flex-wrap items-center justify-between gap-3 border-border border-b bg-background px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="grid size-9 place-items-center border border-border bg-foreground text-background"
                    >
                      <BotIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-black text-sm uppercase leading-none tracking-normal">
                        {agentMeta.name}
                      </p>
                      <p className="mt-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-normal">
                        {activeScenario.model}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-2 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-normal',
                        isPlaying
                          ? 'bg-foreground text-background'
                          : 'bg-background'
                      )}
                    >
                      <CircleIcon
                        className={cn(
                          'size-2 stroke-none',
                          isPlaying
                            ? 'animate-pulse fill-accent'
                            : 'fill-foreground'
                        )}
                      />
                      {isPlaying ? 'streaming' : 'idle'}
                    </span>
                  </div>
                </header>

                <div className="min-h-0 flex-1 overflow-hidden bg-background">
                  <AgentChatTranscript
                    className="h-full"
                    emptyDescription="Pick a scenario to preview an agent run."
                    emptyTitle="No run selected"
                    messages={[...displayMessages]}
                    workflowStatus={displayStatus}
                  />
                </div>

                <div className="border-border border-t bg-muted px-5 py-4">
                  <PromptInput
                    onSubmit={() => {
                      /* static demo */
                    }}
                  >
                    <PromptInputTextarea
                      onChange={(event) =>
                        dispatch({
                          type: 'input',
                          value: event.currentTarget.value,
                        })
                      }
                      placeholder="Ask this agent…"
                      value={input}
                    />
                    <PromptInputFooter>
                      <div />
                      <PromptInputSubmit disabled />
                    </PromptInputFooter>
                  </PromptInput>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
