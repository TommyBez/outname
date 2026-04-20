import Link from "next/link"

export default function NotFound() {
  return (
    <main className="min-h-svh grid place-items-center bg-background px-6">
      <div className="max-w-md">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-3 font-serif text-4xl font-medium leading-tight tracking-tight text-balance">
          Nothing here.
        </h1>
        <p className="mt-4 text-sm text-muted-foreground text-pretty">
          The page you were looking for doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 text-sm text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70"
        >
          Back to today&apos;s briefing
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>
    </main>
  )
}
