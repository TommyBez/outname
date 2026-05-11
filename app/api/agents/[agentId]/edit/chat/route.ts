import { POST as handleAgentEditChatPost } from '@/agents/api/edit-chat/route-handler'

export async function POST(
  req: Request,
  ctx: { params: Promise<{ agentId: string }> }
) {
  return await handleAgentEditChatPost(req, ctx)
}
