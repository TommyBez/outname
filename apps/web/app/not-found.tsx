import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="swiss-grid-pattern grid min-h-svh place-items-center bg-background px-6">
      <div className="max-w-md border-4 border-foreground bg-background p-8">
        <p className="swiss-label text-accent">404</p>
        <h1 className="mt-4 text-balance font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter">
          Nothing here
        </h1>
        <p className="mt-4 text-pretty text-muted-foreground text-sm">
          The page you were looking for doesn&apos;t exist or has moved.
        </p>
        <Link
          className="mt-8 inline-flex h-11 items-center gap-2 border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
          href="/"
        >
          Back home
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
