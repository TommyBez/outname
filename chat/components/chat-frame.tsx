interface ChatFrameProps {
  agentId: string
  agentName: string
  children: React.ReactNode
  enabled: boolean
}

export function ChatFrame({ children }: ChatFrameProps) {
  return <div className="flex h-full min-w-0 flex-col">{children}</div>
}
