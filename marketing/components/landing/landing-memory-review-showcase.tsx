'use client'

import { CheckIcon, RefreshCwIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import {
  type MemoryId,
  memoryById,
  memoryFiles,
} from '@/marketing/components/landing/landing-data'
import {
  panelVariants,
  revealVariants,
  staggerVariants,
} from '@/marketing/components/landing/landing-motion'

export function LandingMemoryReviewShowcase({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  const [activeMemoryId, setActiveMemoryId] = useState<MemoryId>('identity')
  const [reviewed, setReviewed] = useState(false)
  const activeMemory = memoryById(activeMemoryId)

  return (
    <section className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12">
      <motion.div
        className="mx-auto max-w-7xl"
        initial={shouldReduceMotion ? false : 'hidden'}
        variants={staggerVariants}
        viewport={{ once: true, margin: '-80px' }}
        whileInView="visible"
      >
        <motion.div
          className="grid gap-5 border-foreground border-t-4 pt-5 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] md:items-end"
          variants={revealVariants}
        >
          <div>
            <p className="swiss-label text-accent">Memory</p>
            <h2 className="mt-4 text-balance font-black text-5xl uppercase leading-[0.88] tracking-normal md:text-7xl">
              Readable memory, reviewable changes.
            </h2>
          </div>
          <p className="max-w-2xl text-muted-foreground leading-relaxed">
            Agents work in markdown. You can inspect their logs, memory files,
            and dreaming diffs before trusting what changed.
          </p>
        </motion.div>

        <motion.div
          className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,0.55fr)]"
          variants={revealVariants}
        >
          <div className="border-2 border-foreground bg-background p-2">
            <div className="grid min-h-120 border border-foreground/15 bg-muted lg:grid-cols-[15rem_minmax(0,1fr)]">
              <div className="border-foreground border-b-2 bg-background lg:border-r-2 lg:border-b-0">
                {memoryFiles.map((file) => (
                  <button
                    className={
                      activeMemoryId === file.id
                        ? 'grid w-full gap-2 border-foreground border-b-2 bg-foreground p-4 text-left text-background last:border-b-0'
                        : 'ease grid w-full gap-2 border-foreground border-b-2 bg-background p-4 text-left transition-colors duration-150 last:border-b-0 hover:bg-muted'
                    }
                    key={file.id}
                    onClick={() => {
                      setActiveMemoryId(file.id)
                      setReviewed(false)
                    }}
                    type="button"
                  >
                    <span className="font-black text-sm uppercase tracking-normal">
                      {file.label}
                    </span>
                    <span
                      className={
                        activeMemoryId === file.id
                          ? 'font-mono text-[10px] text-background/60 uppercase tracking-normal'
                          : 'font-mono text-[10px] text-muted-foreground uppercase tracking-normal'
                      }
                    >
                      {file.path}
                    </span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  animate="visible"
                  className="p-5 md:p-7"
                  exit="exit"
                  initial={shouldReduceMotion ? false : 'hidden'}
                  key={activeMemory.id}
                  variants={panelVariants}
                >
                  <p className="swiss-label text-accent">{activeMemory.tag}</p>
                  <h3 className="mt-4 font-black text-5xl uppercase leading-[0.86] tracking-normal md:text-7xl">
                    {activeMemory.path}
                  </h3>
                  <p className="mt-5 max-w-xl text-muted-foreground leading-relaxed">
                    {activeMemory.detail}
                  </p>

                  <div className="mt-8 grid gap-3 font-mono text-xs">
                    <div className="border-2 border-foreground bg-background p-4">
                      <p className="text-muted-foreground uppercase tracking-normal">
                        before
                      </p>
                      <p className="mt-3 whitespace-pre-wrap">
                        - stale next step
                      </p>
                    </div>
                    <div className="border-2 border-foreground bg-background p-4">
                      <p className="text-muted-foreground uppercase tracking-normal">
                        after
                      </p>
                      <p className="mt-3 whitespace-pre-wrap">
                        + reviewed next step
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="border-2 border-foreground bg-foreground p-6 text-background">
              <p className="swiss-label text-accent">Review diff</p>
              <p className="mt-6 font-black text-5xl uppercase leading-[0.86] tracking-normal">
                {reviewed ? 'Reviewed' : 'Needs review'}
              </p>
              <button
                className="ease mt-8 inline-flex min-h-12 items-center justify-center gap-3 border-2 border-background bg-background px-4 font-bold text-foreground text-xs uppercase tracking-normal transition-[transform,background-color,color] duration-150 hover:bg-accent active:scale-[0.98]"
                onClick={() => setReviewed(true)}
                type="button"
              >
                <CheckIcon className="size-4" />
                Mark reviewed
              </button>
            </div>
            <div className="border-2 border-foreground bg-accent p-6">
              <p className="swiss-label">Mirrored after event</p>
              <div className="mt-6 grid gap-2">
                {['chat', 'heartbeat', 'dreaming', 'sub-agent'].map((item) => (
                  <div
                    className="flex items-center justify-between border-2 border-foreground bg-background px-3 py-2"
                    key={item}
                  >
                    <span className="font-black text-xs uppercase tracking-normal">
                      {item}
                    </span>
                    <RefreshCwIcon className="size-4" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
