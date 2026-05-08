import Link from 'next/link'
import type { AgentCreationResult } from '@/agents/server/creation-types'
import { Button } from '@/components/ui/button'

export function CreationSuccessCard({
  result,
}: {
  result: AgentCreationResult
}) {
  const failedAttachments = result.attachments.filter((item) => !item.ok)
  const pendingAttachments = result.attachments.filter(
    (item) => item.status === 'pending'
  )

  return (
    <section className="w-full border-2 border-foreground bg-background">
      <div className="border-foreground border-b-2 bg-foreground px-4 py-3 text-background">
        <p className="font-bold text-xs uppercase tracking-[0.18em]">
          Agent ready
        </p>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="font-black font-serif text-3xl uppercase leading-none tracking-tighter">
            {result.name}
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            {result.created
              ? 'Created and queued for its first sandbox boot.'
              : 'Already created from this approval; showing the existing agent.'}
          </p>
        </div>

        {pendingAttachments.length > 0 && (
          <p className="border-2 border-foreground bg-muted px-3 py-2 text-sm">
            {pendingAttachments.length} tool environment{' '}
            {pendingAttachments.length === 1 ? 'is' : 'are'} building.
          </p>
        )}

        {failedAttachments.length > 0 && (
          <div className="border-2 border-destructive bg-destructive/5 px-3 py-2 text-destructive text-sm">
            <p className="font-bold">Some tools were not attached.</p>
            <ul className="mt-2 list-disc pl-4">
              {failedAttachments.map((item) => (
                <li key={`${item.kind}-${item.toolId}`}>
                  {item.toolId}: {item.error ?? 'Unknown error'}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={result.overviewUrl}>Open agent</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={result.editUrl}>Review config</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={result.toolsUrl}>Tools</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
