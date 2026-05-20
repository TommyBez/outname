export const WORKFLOW_STREAM_UNAVAILABLE_MESSAGE =
  'Workflow stream is no longer available on this platform.'

export function isWorkflowStreamUnavailableMessage(message: string): boolean {
  return (
    message.startsWith('Workflow stream is no longer available') ||
    message.includes('workflow unavailable in this environment')
  )
}
