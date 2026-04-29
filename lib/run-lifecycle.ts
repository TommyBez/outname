/** Values persisted on `runs.status` and used across run UI. */
export type RunLifecycleStatus = 'running' | 'completed' | 'failed'

export function toRunLifecycleStatus(status: string): RunLifecycleStatus {
  if (status === 'running' || status === 'completed' || status === 'failed') {
    return status
  }
  return 'running'
}
