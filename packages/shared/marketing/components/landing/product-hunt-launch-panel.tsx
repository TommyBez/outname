import type { ProductHuntLaunchState } from '@outname/shared/launch/product-hunt'
import {
  buildProductHuntLandingPath,
  buildProductHuntWaitlistPath,
  isProductHuntLaunchVisible,
  PRODUCT_HUNT_LAUNCH,
  productHuntStackHighlights,
} from '@outname/shared/launch/product-hunt'
import { Button } from '@outname/ui/components/ui/button'
import { ExternalLinkIcon } from 'lucide-react'
import Link from 'next/link'

function getLaunchPanelCopy(state: ProductHuntLaunchState) {
  if (state.phase === 'live') {
    return {
      eyebrow: 'Product Hunt / live now',
      title: 'Vercel Day launch is live.',
      body: 'OUTNA.ME is live on Product Hunt. The useful ask is feedback: what is clear, what is confusing, and what should an agent do first?',
    }
  }

  if (state.phase === 'postlaunch') {
    return {
      eyebrow: 'Product Hunt / feedback loop',
      title: 'Launch comments are still useful.',
      body: 'The launch window is over, but the feedback thread still helps tighten onboarding, docs, and the first early-access batch.',
    }
  }

  return {
    eyebrow: 'Product Hunt / Vercel Day',
    title: 'Launching Tuesday for Vercel Day.',
    body: `Scheduled for ${PRODUCT_HUNT_LAUNCH.launchDateLabel} at ${PRODUCT_HUNT_LAUNCH.pacificLaunchTimeLabel} (${PRODUCT_HUNT_LAUNCH.localLaunchTimeLabel}). Built with Sandbox, Workflow, AI SDK, and Chat SDK.`,
  }
}

export function ProductHuntLaunchPanel({
  launchState,
  waitlistEnabled,
}: {
  launchState: ProductHuntLaunchState | null
  waitlistEnabled: boolean
}) {
  if (!isProductHuntLaunchVisible(launchState)) {
    return null
  }

  const copy = getLaunchPanelCopy(launchState)
  const waitlistHref = buildProductHuntWaitlistPath('launch-panel')
  const launchHref =
    launchState.launchUrl ?? buildProductHuntLandingPath('launch-panel')

  return (
    <section
      aria-label="Product Hunt Vercel Day launch"
      className="px-4 pt-24 sm:px-6 md:px-10 lg:px-12"
      id="product-hunt"
    >
      <div className="mx-auto grid max-w-7xl gap-5 border-4 border-foreground bg-accent p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:p-5">
        <div className="min-w-0">
          <p className="swiss-label text-foreground">{copy.eyebrow}</p>
          <h2 className="mt-3 max-w-4xl text-balance font-black text-4xl uppercase leading-[0.86] tracking-normal md:text-6xl">
            {copy.title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed md:text-base">
            {copy.body}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row md:justify-end">
          {launchState.launchUrl ? (
            <Button asChild className="min-h-14" size="lg">
              <a href={launchHref} rel="noopener noreferrer" target="_blank">
                Open Product Hunt
                <ExternalLinkIcon className="size-4" />
              </a>
            </Button>
          ) : (
            <Button asChild className="min-h-14" size="lg">
              <Link href={launchHref}>Launch landing page</Link>
            </Button>
          )}
          {waitlistEnabled ? (
            <Button
              asChild
              className="min-h-14 bg-background text-foreground hover:bg-foreground hover:text-background"
              size="lg"
              variant="outline"
            >
              <Link href={waitlistHref}>Join waitlist</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export function ProductHuntVercelStackSection({
  launchState,
  forceVisible = false,
}: {
  forceVisible?: boolean
  launchState: ProductHuntLaunchState | null
}) {
  if (!(forceVisible || isProductHuntLaunchVisible(launchState))) {
    return null
  }

  return (
    <section
      className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12"
      id="vercel-day-stack"
    >
      <div className="mx-auto max-w-7xl border-foreground border-t-4 pt-5">
        <div className="grid gap-5 md:grid-cols-[minmax(0,0.86fr)_minmax(0,1fr)] md:items-end">
          <div>
            <p className="swiss-label text-accent">Vercel Day architecture</p>
            <h2 className="mt-4 text-balance font-black text-5xl uppercase leading-[0.88] tracking-normal md:text-7xl">
              Built on Vercel-native agent primitives.
            </h2>
          </div>
          <p className="max-w-2xl text-muted-foreground leading-relaxed">
            OUTNA.ME is not just hosted on Vercel. The core agent runtime uses
            Vercel primitives for model work, durable execution, channel
            surfaces, and isolated agent state.
          </p>
        </div>

        <div className="mt-10 grid border-2 border-foreground md:grid-cols-2">
          {productHuntStackHighlights.map((item, index) => (
            <article
              className="min-h-52 border-foreground border-b-2 p-5 md:[&:nth-child(odd)]:border-r-2 md:[&:nth-last-child(-n+2)]:border-b-0"
              key={item.label}
            >
              <p className="font-mono text-muted-foreground text-xs uppercase tracking-normal">
                0{index + 1} / 04
              </p>
              <h3 className="mt-4 font-black text-3xl uppercase leading-none tracking-normal">
                {item.label}
              </h3>
              <p className="mt-4 max-w-md text-muted-foreground text-sm leading-relaxed">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
