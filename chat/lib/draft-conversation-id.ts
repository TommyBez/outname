export function newDraftConversationId() {
  return (
    'cc_' +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36).slice(-4)
  )
}

export function isDraftConversationId(
  value: string | undefined
): value is string {
  return typeof value === 'string' && value.startsWith('cc_')
}
