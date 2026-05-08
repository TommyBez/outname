import { POST as handleAgentCreationChatPost } from '@/agents/api/creation-chat/route-handler'

export async function POST(req: Request) {
  return await handleAgentCreationChatPost(req)
}
