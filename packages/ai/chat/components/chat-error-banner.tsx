interface ChatErrorBannerProps {
  className?: string
  message: string | undefined
}

export function ChatErrorBanner({ className, message }: ChatErrorBannerProps) {
  return (
    <p
      className={
        className ??
        'mb-3 border border-destructive bg-destructive px-3 py-2 font-bold text-destructive-foreground text-xs uppercase tracking-[0.12em]'
      }
      role="alert"
    >
      {message || 'Something went wrong. Try again.'}
    </p>
  )
}
