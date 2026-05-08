export type HeartbeatMode = 'normal' | 'reflection'

export function activityMessage(mode: HeartbeatMode, message: string): string {
  return mode === 'reflection' ? `Reflection: ${message}` : message
}
