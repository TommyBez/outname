export function userAgentsTag(userId: string) {
  return `user-agents-${userId}`
}

export function agentTag(agentId: string) {
  return `agent-${agentId}`
}

export function agentRunsTag(agentId: string) {
  return `agent-runs-${agentId}`
}

export function runTag(runId: string) {
  return `run-${runId}`
}

export function runsIndexTag() {
  return 'runs-index'
}

export function userConnectionsTag(userId: string) {
  return `user-connections-${userId}`
}

export function agentToolsTag(agentId: string) {
  return `agent-tools-${agentId}`
}

export function conversationListTag(agentId: string) {
  return `conversation-list-${agentId}`
}
