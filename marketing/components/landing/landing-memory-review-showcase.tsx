'use client'

import { RefreshCwIcon } from 'lucide-react'
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

const memoryPreviewById: Record<MemoryId, string> = {
  identity: [
    'Name: Atlas',
    'Role: Operations copilot',
    'Tone: calm, direct',
  ].join('\n'),
  instructions: [
    '- Read MEMORY.md before planning.',
    '- Keep tasks concrete.',
    '- Stop after one useful action.',
  ].join('\n'),
  user: [
    'Timezone: Europe/Rome',
    'Prefers concise updates',
    'Goal: keep weekly priorities aligned',
  ].join('\n'),
  logs: [
    '- Reviewed inbox summary',
    '- Deferred one follow-up to Friday',
    '- Logged a blocker in CRM sync',
  ].join('\n'),
  dreams: [
    '## 2026-05-13',
    '- Pattern: follow-ups slip after late meetings.',
    '- Next step: tighten weekly task review cadence.',
  ].join('\n'),
}

export function LandingMemoryReviewShowcase({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  const [activeMemoryId, setActiveMemoryId] = useState<MemoryId>('identity')
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
              Readable memory, reflection notes.
            </h2>
          </div>
          <p className="max-w-2xl text-muted-foreground leading-relaxed">
            Agents work in markdown. You can inspect their logs, memory files,
            and reflection output after each event.
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

                  <div className="mt-8 border-2 border-foreground bg-background p-4 font-mono text-xs">
                    <p className="text-muted-foreground uppercase tracking-normal">
                      latest excerpt
                    </p>
                    <pre className="mt-3 whitespace-pre-wrap">
                      {memoryPreviewById[activeMemory.id]}
                    </pre>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="border-2 border-foreground bg-foreground p-6 text-background">
              <p className="swiss-label text-accent">Readable markdown</p>
              <p className="mt-6 font-black text-5xl uppercase leading-[0.86] tracking-normal">
                {activeMemory.label}
              </p>
              <p className="mt-6 max-w-sm text-background/75 text-sm leading-relaxed">
                Open the latest mirrored file state without restarting the
                agent&apos;s sandbox.
              </p>
            </div>
            <div className="border-2 border-foreground bg-accent p-6">
              <p className="swiss-label">Mirrored after event</p>
              <div className="mt-6 grid gap-2">
                {['chat', 'heartbeat', 'reflection', 'sub-agent'].map(
                  (item) => (
                    <div
                      className="flex items-center justify-between border-2 border-foreground bg-background px-3 py-2"
                      key={item}
                    >
                      <span className="font-black text-xs uppercase tracking-normal">
                        {item}
                      </span>
                      <RefreshCwIcon className="size-4" />
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
