'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import {
  type ToolId,
  toolById,
  tools,
} from '@/marketing/components/landing/landing-data'
import {
  panelVariants,
  revealVariants,
  staggerVariants,
} from '@/marketing/components/landing/landing-motion'

export function LandingToolShowcase({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  const [activeToolId, setActiveToolId] = useState<ToolId>('resend')
  const activeTool = toolById(activeToolId)
  const ActiveIcon = activeTool.icon

  return (
    <section className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12">
      <motion.div
        className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]"
        initial={shouldReduceMotion ? false : 'hidden'}
        variants={staggerVariants}
        viewport={{ once: true, margin: '-80px' }}
        whileInView="visible"
      >
        <motion.div
          className="border-foreground border-t-4 pt-5"
          variants={revealVariants}
        >
          <p className="swiss-label text-accent">Tooling</p>
          <h2 className="mt-4 text-balance font-black text-5xl uppercase leading-[0.88] tracking-normal md:text-7xl">
            Give agents approved ways to act.
          </h2>
        </motion.div>

        <motion.div
          className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]"
          variants={revealVariants}
        >
          <div aria-label="Tool catalog" className="grid gap-2" role="tablist">
            {tools.map((toolMode) => {
              const Icon = toolMode.icon
              const isActive = activeToolId === toolMode.id
              return (
                <button
                  aria-selected={isActive}
                  className={
                    isActive
                      ? 'flex min-h-16 items-center gap-3 border-2 border-foreground bg-foreground p-3 text-left text-background'
                      : 'ease flex min-h-16 items-center gap-3 border-2 border-foreground bg-background p-3 text-left transition-colors duration-150 hover:bg-muted'
                  }
                  key={toolMode.id}
                  onClick={() => setActiveToolId(toolMode.id)}
                  role="tab"
                  type="button"
                >
                  <span
                    className={
                      isActive
                        ? 'grid size-10 place-items-center bg-background text-foreground'
                        : 'grid size-10 place-items-center bg-muted'
                    }
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="font-black text-xs uppercase tracking-normal">
                    {toolMode.label}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="relative overflow-hidden border-2 border-foreground bg-foreground p-2 text-background">
            <div className="min-h-120 border border-background/20 p-5 md:p-7">
              <AnimatePresence mode="wait">
                <motion.div
                  animate="visible"
                  exit="exit"
                  initial={shouldReduceMotion ? false : 'hidden'}
                  key={activeTool.id}
                  variants={panelVariants}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-background border-b-2 pb-5">
                    <div>
                      <p className="swiss-label text-accent">Approved tool</p>
                      <h3 className="mt-4 font-black text-5xl uppercase leading-[0.86] tracking-normal md:text-7xl">
                        {activeTool.label}
                      </h3>
                    </div>
                    <span className="grid size-16 place-items-center border-2 border-background">
                      <ActiveIcon className="size-7" />
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
                    <div className="grid gap-3">
                      {activeTool.config.map((item, index) => (
                        <motion.div
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between gap-4 border border-background/25 bg-background px-4 py-3 text-foreground"
                          initial={
                            shouldReduceMotion ? false : { opacity: 0, x: -16 }
                          }
                          key={item}
                          transition={{
                            delay: shouldReduceMotion ? 0 : index * 0.06,
                            duration: 0.2,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                        >
                          <span className="font-mono text-xs uppercase tracking-normal">
                            {item}
                          </span>
                          <span className="size-2 bg-accent" />
                        </motion.div>
                      ))}
                    </div>

                    <div className="grid gap-3">
                      <div className="border border-background/25 p-4">
                        <p className="font-bold text-[10px] text-background/60 uppercase tracking-normal">
                          Requirement
                        </p>
                        <p className="mt-3 font-black text-xl uppercase leading-none tracking-normal">
                          {activeTool.requirement}
                        </p>
                      </div>
                      <div className="border border-background/25 bg-background p-4 text-foreground">
                        <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-normal">
                          Runtime output
                        </p>
                        <p className="mt-3 font-black text-xl uppercase leading-none tracking-normal">
                          {activeTool.output}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border border-background/25 bg-black p-4 font-mono text-background text-xs leading-relaxed">
                    <p>$ attach approved capability</p>
                    <p className="text-accent">{`> attach ${activeTool.id}`}</p>
                    <p>{`> ${activeTool.requirement}`}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
