'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { newChatPath } from '@/chat/components/agent-sidebar-workspace/conversations'

interface ChatIndexRedirectProps {
  agentId: string
  mostRecentConversationId: string | null
}

export function ChatIndexRedirect({
  agentId,
  mostRecentConversationId,
}: ChatIndexRedirectProps) {
  const router = useRouter()
  const pathname = usePathname()
  const indexPath = `/agents/${agentId}/chat`

  useEffect(() => {
    if (pathname !== indexPath) {
      return
    }
    if (mostRecentConversationId) {
      router.replace(`/agents/${agentId}/chat/${mostRecentConversationId}`)
      return
    }
    router.replace(newChatPath(agentId))
  }, [agentId, indexPath, mostRecentConversationId, pathname, router])

  return <ChatIndexSkeleton />
}

function ChatIndexSkeleton() {
  return (
    <div className="flex h-full min-w-0 flex-col gap-3">
      <div className="h-64 w-full flex-1 animate-pulse rounded-sm bg-muted" />
      <div className="h-12 w-full animate-pulse rounded-sm bg-muted" />
    </div>
  )
}
