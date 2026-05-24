'use client'

import { useEffect, useState } from 'react'
import type { AgentEventTranscriptPayload } from '@/agent-runtime/shared/event-transcript'
import type { AgentEventSummary } from '@/agent-runtime/shared/event-types'
import {
  createStoredTranscriptFailureState,
  createStoredTranscriptInitialState,
  createStoredTranscriptSuccessState,
  readTranscriptErrorMessage,
  type UseAgentEventTranscriptResult,
  unavailableTranscriptState,
} from './agent-event-transcript-shared'

export function useAgentEventStoredTranscript(input: {
  agentId: string
  enabled: boolean
  event: AgentEventSummary | null
}): UseAgentEventTranscriptResult {
  const { agentId, enabled, event } = input
  const [state, setState] = useState<UseAgentEventTranscriptResult>(
    unavailableTranscriptState()
  )

  useEffect(() => {
    if (!(enabled && event)) {
      setState(unavailableTranscriptState())
      return
    }

    const controller = new AbortController()
    setState(createStoredTranscriptInitialState(event))

    loadStoredTranscript({
      agentId,
      event,
      signal: controller.signal,
    })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setState(
            createStoredTranscriptSuccessState(event, {
              messages: payload.messages,
              workflowStatus: payload.workflowStatus,
            })
          )
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setState(
            createStoredTranscriptFailureState(
              event,
              readTranscriptErrorMessage(reason)
            )
          )
        }
      })

    return () => {
      controller.abort()
    }
  }, [agentId, enabled, event])

  return state
}

async function loadStoredTranscript(input: {
  agentId: string
  event: AgentEventSummary
  signal: AbortSignal
}): Promise<AgentEventTranscriptPayload> {
  const response = await fetch(
    `/api/agents/${input.agentId}/events/${input.event.id}/transcript`,
    {
      cache: 'no-store',
      signal: input.signal,
    }
  )
  if (!response.ok) {
    throw new Error(`Event transcript failed with HTTP ${response.status}`)
  }

  return (await response.json()) as AgentEventTranscriptPayload
}
