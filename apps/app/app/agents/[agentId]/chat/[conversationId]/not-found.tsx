export default function ConversationNotFound() {
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-start justify-center gap-3">
      <p className="swiss-label text-muted-foreground">Not found</p>
      <h2 className="font-semibold text-xl tracking-tight">
        This conversation doesn&apos;t exist.
      </h2>
      <p className="text-muted-foreground text-sm">
        It may have been deleted, or you may have followed a stale link. Pick
        another conversation from the sidebar or start a new chat.
      </p>
    </div>
  )
}
