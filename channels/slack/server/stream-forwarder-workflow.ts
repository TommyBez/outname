import { forwardSlackStreamToThread } from './stream-forwarder-steps'

export async function slackStreamForwarderWorkflow(input: {
  channelId: string
  eventId: string
  replyNamespace: string
  recipientUserId?: string
  teamId: string
  threadTs: string
  workflowRunId: string
}): Promise<void> {
  'use workflow'
  await forwardSlackStreamToThread(input)
}
