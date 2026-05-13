export type HeartbeatMode = 'normal' | 'dreaming'

export function activityMessage(mode: HeartbeatMode, message: string): string {
  return mode === 'dreaming' ? `Dreaming: ${message}` : message
}
