'use client'

import { ArrowRightIcon, CheckIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { FeatureMode } from '@/marketing/components/landing/landing-data'
import {
  type FeatureId,
  featureById,
  featureModes,
} from '@/marketing/components/landing/landing-data'
import { panelVariants } from '@/marketing/components/landing/landing-motion'

export function LandingFeatureWorkbench({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  const [activeFeatureId, setActiveFeatureId] = useState<FeatureId>('chat')
  const [isPinned, setIsPinned] = useState(false)
  const activeFeature = featureById(activeFeatureId)

  useEffect(() => {
    if (shouldReduceMotion || isPinned) {
      return
    }

    const timer = window.setInterval(() => {
      setActiveFeatureId((currentId) => {
        const currentIndex = featureModes.findIndex(
          (feature) => feature.id === currentId
        )
        const nextIndex = (currentIndex + 1) % featureModes.length
        return featureModes[nextIndex].id
      })
    }, 4200)

    return () => window.clearInterval(timer)
  }, [isPinned, shouldReduceMotion])

  return (
    <section
      aria-label="Interactive feature showcase"
      className="border-2 border-foreground bg-background p-2"
      id="showcase"
    >
      <div className="grid min-h-[28rem] gap-0 border border-foreground/15 bg-muted">
        <div
          aria-label="Feature modes"
          className="grid grid-cols-2 border-foreground border-b-2 bg-background sm:grid-cols-5"
          role="tablist"
        >
          {featureModes.map((feature) => (
            <FeatureModeButton
              active={activeFeatureId === feature.id}
              feature={feature}
              key={feature.id}
              onSelect={() => {
                setActiveFeatureId(feature.id)
                setIsPinned(true)
              }}
              shouldAnimateProgress={
                !(shouldReduceMotion || isPinned) &&
                activeFeatureId === feature.id
              }
            />
          ))}
        </div>

        <div className="relative min-h-[22rem] overflow-hidden bg-background p-4 md:p-5">
          <div
            aria-hidden
            className="swiss-diagonal absolute inset-0 opacity-60"
          />
          <AnimatePresence mode="wait">
            <motion.div
              animate="visible"
              className="relative z-10 grid h-full gap-4 lg:grid-rows-[auto_minmax(0,1fr)_auto]"
              exit="exit"
              initial={false}
              key={activeFeature.id}
              variants={panelVariants}
            >
              <FeatureHeader feature={activeFeature} />
              <FeatureStage
                feature={activeFeature}
                shouldReduceMotion={shouldReduceMotion}
              />
              <FeatureFooter feature={activeFeature} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

function FeatureModeButton({
  active,
  feature,
  onSelect,
  shouldAnimateProgress,
}: {
  active: boolean
  feature: FeatureMode
  onSelect: () => void
  shouldAnimateProgress: boolean
}) {
  const Icon = feature.icon

  return (
    <button
      aria-selected={active}
      className={
        active
          ? 'group relative min-h-20 overflow-hidden border-foreground border-r-2 border-b-2 bg-foreground p-4 text-left text-background sm:last:border-r-0'
          : 'group ease relative min-h-20 overflow-hidden border-foreground border-r-2 border-b-2 bg-background p-4 text-left transition-colors duration-150 hover:bg-muted sm:last:border-r-0'
      }
      onClick={onSelect}
      role="tab"
      type="button"
    >
      <div className="flex items-center gap-3">
        <span
          className={
            active
              ? 'grid size-10 place-items-center border border-background/30 bg-background text-foreground'
              : 'ease grid size-10 place-items-center border border-foreground bg-muted text-foreground transition-transform duration-150 group-active:scale-[0.96]'
          }
        >
          <Icon className="size-4" />
        </span>
        <span>
          <span className="block font-black text-sm uppercase tracking-normal">
            {feature.label}
          </span>
          <span
            className={
              active
                ? 'mt-1 block font-mono text-[10px] text-background/60 uppercase tracking-normal'
                : 'mt-1 block font-mono text-[10px] text-muted-foreground uppercase tracking-normal'
            }
          >
            {feature.metric}
          </span>
        </span>
      </div>
      {shouldAnimateProgress ? (
        <motion.span
          animate={{ scaleX: 1 }}
          aria-hidden
          className="absolute right-0 bottom-0 left-0 h-1 origin-left bg-accent"
          initial={{ scaleX: 0 }}
          transition={{ duration: 4.2, ease: 'linear' }}
        />
      ) : null}
    </button>
  )
}

function FeatureHeader({ feature }: { feature: FeatureMode }) {
  const Icon = feature.icon

  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-foreground border-b-2 pb-5">
      <div className="min-w-0">
        <p className="swiss-label text-accent">Run mode</p>
        <h2 className="mt-3 max-w-2xl text-balance font-black text-4xl uppercase leading-[0.88] tracking-normal md:text-5xl 2xl:text-6xl">
          {feature.title}
        </h2>
      </div>
      <div className="grid size-16 shrink-0 place-items-center border-2 border-foreground bg-background">
        <Icon className="size-7" />
      </div>
    </header>
  )
}

function FeatureStage({
  feature,
  shouldReduceMotion,
}: {
  feature: FeatureMode
  shouldReduceMotion: boolean
}) {
  const Icon = feature.icon

  return (
    <div className="grid min-h-0 gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(14rem,0.9fr)]">
      <div className="relative overflow-hidden border-2 border-foreground bg-foreground p-4 text-background">
        <div className="flex items-center justify-between gap-3 border-background border-b-2 pb-4">
          <p className="font-mono text-[10px] uppercase tracking-normal">
            {feature.signal}
          </p>
          <span className="grid size-9 place-items-center border border-background/40">
            <Icon className="size-4" />
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {feature.steps.map((step, index) => (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border border-background/25 bg-background p-3 text-foreground"
              initial={false}
              key={step}
              transition={{
                delay: shouldReduceMotion ? 0 : index * 0.08,
                duration: 0.24,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <span className="grid size-9 place-items-center bg-accent font-black text-sm">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="font-black text-sm uppercase tracking-normal">
                {step}
              </p>
              <CheckIcon className="size-4" />
            </motion.div>
          ))}
        </div>

        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  rotate: [0, 3, -2, 0],
                  y: [0, -4, 2, 0],
                }
          }
          aria-hidden
          className="absolute right-5 bottom-5 grid size-20 place-items-center border-2 border-background/35"
          transition={{
            duration: 5.8,
            ease: [0.65, 0, 0.35, 1],
            repeat: Number.POSITIVE_INFINITY,
          }}
        >
          <span className={`size-8 ${feature.accent}`} />
        </motion.div>
      </div>

      <div className="hidden gap-4 2xl:grid">
        <div className="border-2 border-foreground bg-background p-4">
          <p className="swiss-label text-accent">State</p>
          <p className="mt-5 font-black text-5xl uppercase leading-[0.86] tracking-normal">
            {feature.metric}
          </p>
          <p className="mt-4 font-mono text-muted-foreground text-xs uppercase tracking-normal">
            {feature.id}
          </p>
        </div>
        <div className="border-2 border-foreground bg-muted p-4">
          <p className="swiss-label text-accent">Trace</p>
          <div className="mt-5 grid gap-2">
            {['Next.js', 'Workflow', 'Sandbox', 'Postgres'].map((item) => (
              <div
                className="flex items-center justify-between gap-3 border border-foreground bg-background px-3 py-2"
                key={item}
              >
                <span className="font-bold text-xs uppercase tracking-normal">
                  {item}
                </span>
                <span className="size-2 bg-accent" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureFooter({ feature }: { feature: FeatureMode }) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 border-foreground border-t-2 pt-5">
      <p className="font-mono text-muted-foreground text-xs uppercase tracking-normal">
        Available after sign-in
      </p>
      <Link
        className="ease inline-flex min-h-11 items-center justify-center gap-3 border-2 border-foreground bg-background px-4 font-bold text-xs uppercase tracking-normal transition-[transform,background-color,color] duration-150 hover:bg-foreground hover:text-background active:scale-[0.98]"
        href={feature.href}
      >
        Open
        <ArrowRightIcon className="size-4" />
      </Link>
    </footer>
  )
}
