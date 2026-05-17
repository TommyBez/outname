import type {
  AgentChatMessage,
  WorkflowStatusData,
} from '@/agent-runtime/server/chat-status'

export interface ChatShowcaseScenario {
  description: string
  id: 'triage' | 'research' | 'digest'
  messages: AgentChatMessage[]
  model: string
  prompt: string
  relativeTime: string
  status: WorkflowStatusData
  title: string
}

export const agentMeta = {
  attached: '3 tools · 1 sub-agent · 2 channels',
  defaultModel: 'claude-sonnet-4-6',
  name: 'INBOX SENTINEL',
} as const

export const showcaseScenarios: readonly ChatShowcaseScenario[] = [
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
