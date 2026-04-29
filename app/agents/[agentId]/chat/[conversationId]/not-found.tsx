export default function ConversationNotFound() {
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-start justify-center gap-3">
      <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">
        Not found
      </p>
      <h2 className="font-medium font-serif text-2xl leading-tight tracking-tight">
        This conversation doesn&apos;t exist.
      </h2>
      <p className="text-muted-foreground text-sm">
        It may have been deleted, or you may have followed a stale link. Pick
        another conversation from the sidebar or start a new chat.
      </p>
    </div>
  )
}
