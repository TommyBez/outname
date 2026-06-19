import { Button } from '@outname/ui/components/ui/button'
import Link from 'next/link'

export default function AgentNotFound() {
  return (
    <div className="border border-border bg-background p-8">
      <p className="swiss-label text-brand">404</p>
      <h1 className="mt-4 text-balance font-semibold text-4xl tracking-tight">
        Agent not found
      </h1>
      <p className="mt-4 max-w-md text-pretty text-muted-foreground text-sm">
        This agent doesn&apos;t exist or was deleted. Pick another agent from
        the registry.
      </p>
      <Button asChild className="mt-8" variant="outline">
        <Link href="/agents">Open agent registry →</Link>
      </Button>
    </div>
  )
}
