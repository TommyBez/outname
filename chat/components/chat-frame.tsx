interface ChatFrameProps {
  agentId: string
  agentName: string
  children: React.ReactNode
  enabled: boolean
}

export function ChatFrame({ children }: ChatFrameProps) {
  return (
    <div className="flex h-[42rem] min-h-0 min-w-0 flex-col overflow-hidden">
      {children}
    </div>
  )
}
