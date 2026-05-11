'use client'

import { useEffect, useState } from 'react'
import { getAgentRunTranscriptPreview } from './preview'
import { consumeRunTranscript } from './stream'
import type { AgentRunTranscriptState as AgentRunTranscriptStateType } from './types'

export type { AgentRunTranscriptState } from './types'

export function useAgentRunTranscript(input: {
  agentId: string
  enabled: boolean
  sessionRunId: string | null
}): AgentRunTranscriptStateType {
  const { agentId, enabled, sessionRunId } = input
  const [state, setState] = useState<AgentRunTranscriptStateType>({
    kind: 'idle',
    messages: [],
  })

  useEffect(() => {
    if (!(enabled && sessionRunId)) {
      setState({ kind: 'idle', messages: [] })
      return
    }

    const abort = new AbortController()
    const ctx = { cancelled: false }
    setState({ kind: 'connecting', messages: [] })

    consumeRunTranscript({
      abort,
      agentId,
      ctx,
      setState,
    })

    return () => {
      ctx.cancelled = true
      abort.abort()
    }
  }, [agentId, enabled, sessionRunId])

  return state
}

export function useAgentRunTranscriptPreview(input: {
  enabled: boolean
  lastHeartbeatAt: string | null
  lastReflectionAt: string | null
  sessionRunId: string | null
  streamState: AgentRunTranscriptStateType
}): string {
  return getAgentRunTranscriptPreview(input)
}
