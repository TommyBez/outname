import { POST as handleAgentCreationChatPost } from '@outname/shared/agents/api/creation-chat/route-handler'

export async function POST(req: Request) {
  return await handleAgentCreationChatPost(req)
}
