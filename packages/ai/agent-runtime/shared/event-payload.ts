export interface AgentEventPayloads {
  dreaming: {
    localDate: string
    manual?: boolean
    scheduledAt: string
  }
  heartbeat: {
    manual?: boolean
    scheduledAt: string
  }
  invocation: {
    callStack: string[]
    depth: number
    input: string
    parentRunId?: string | null
    parentToolCallId?: string | null
    parentToolId?: string | null
    streamToken: string
  }
}

export function payloadAs<TType extends keyof AgentEventPayloads>(
  event: { payload: unknown; type: NoInfer<TType> },
  _type: TType
): AgentEventPayloads[TType] {
  return event.payload as AgentEventPayloads[TType]
}
