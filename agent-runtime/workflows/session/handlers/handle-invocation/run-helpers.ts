export function invocationMessageId(): string {
  return `inv_msg_${Math.random().toString(36).slice(2, 10)}`
}
