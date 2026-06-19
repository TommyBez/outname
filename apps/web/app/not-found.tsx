import { Button } from '@outname/ui/components/ui/button'
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6">
      <div className="max-w-md border border-border bg-background p-8">
        <p className="swiss-label text-brand">404</p>
        <h1 className="mt-4 text-balance font-semibold font-serif text-5xl leading-[0.9] tracking-tighter">
          Nothing here
        </h1>
        <p className="mt-4 text-pretty text-muted-foreground text-sm">
          The page you were looking for doesn&apos;t exist or has moved.
        </p>
        <Button asChild className="mt-8" variant="outline">
          <Link href="/">
            Back home
            <span aria-hidden>→</span>
          </Link>
        </Button>
      </div>
    </main>
  )
}
