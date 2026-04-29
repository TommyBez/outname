import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6">
      <div className="max-w-md">
        <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">
          404
        </p>
        <h1 className="mt-3 text-balance font-medium font-serif text-4xl leading-tight tracking-tight">
          Nothing here.
        </h1>
        <p className="mt-4 text-pretty text-muted-foreground text-sm">
          The page you were looking for doesn&apos;t exist or has moved.
        </p>
        <Link
          className="mt-8 inline-flex items-center gap-2 text-foreground text-sm underline underline-offset-4 transition-colors hover:text-foreground/70"
          href="/"
        >
          Back to today&apos;s briefing
          <span
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      </div>
    </main>
  )
}
