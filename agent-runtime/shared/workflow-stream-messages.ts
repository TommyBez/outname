export const WORKFLOW_STREAM_UNAVAILABLE_MESSAGE =
  'Workflow stream is no longer available. Vercel retains workflow streams for 1–30 days depending on your plan; configure WORKFLOW_STREAM_RETENTION_DAYS to match yours.'

export function isWorkflowStreamUnavailableMessage(message: string): boolean {
  return (
    message.startsWith('Workflow stream is no longer available') ||
    message.includes('workflow unavailable in this environment')
  )
}
