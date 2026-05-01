'use client'

import type { Variants } from 'motion/react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { TextLoop } from '@/components/motion-primitives/text-loop'

const featureCards = [
  {
    id: 'mind',
    eyebrow: 'Memory',
    title: 'Agents remember how you operate.',
    body: 'OUTNA.ME gives each agent a readable memory for preferences, goals, tasks, decisions, and daily notes. You can inspect it, edit it, and see what changed.',
    signal: 'Readable memory',
  },
  {
    id: 'hands',
    eyebrow: 'Execution',
    title: 'They can do the work, not just suggest it.',
    body: 'Give an agent tools for email, calendar, files, code, and research. Sandboxed execution lets it run commands and experiments without touching its core identity.',
    signal: 'Sandboxed',
  },
  {
    id: 'heartbeat',
    eyebrow: 'Schedule',
    title: 'They come back on their own.',
    body: 'Set a heartbeat and your agent checks in, reviews context, and moves recurring work forward without waiting for a new prompt.',
    signal: 'Proactive',
  },
  {
    id: 'tools',
    eyebrow: 'Delegation',
    title: 'Agents can call tools and each other.',
    body: 'Attach built-in tools or let one agent hand work to another. Every action stays visible in the same workspace.',
    signal: 'Tool catalog',
  },
] as const

const timelineItems = [
  {
    id: 'chat',
    time: '09:00',
    label: 'Ask once',
    copy: 'Tell an agent what outcome you want: a follow-up drafted, a calendar checked, a task moved forward.',
  },
  {
    id: 'memory',
    time: '09:04',
    label: 'Recover context',
    copy: 'OUTNA.ME pulls the agent back through its instructions, memory, task notes, and tool history.',
  },
  {
    id: 'tool',
    time: '09:07',
    label: 'Use tools',
    copy: 'Calendar, email, files, and custom tools run through a controlled surface you can inspect later.',
  },
  {
    id: 'dream',
    time: '23:30',
    label: 'Remember',
    copy: "The agent writes decisions, follow-ups, and tomorrow's priorities back into readable memory.",
  },
] as const

const capabilityRows = [
  {
    id: 'session',
    name: 'Agent rhythm',
    detail: 'chat / heartbeat / reply',
    status: 'live',
  },
  {
    id: 'system',
    name: 'Readable memory',
    detail: 'goals / notes / decisions',
    status: 'visible',
  },
  {
    id: 'exec',
    name: 'Safe execution',
    detail: 'bash / tools / scratch',
    status: 'sandboxed',
  },
  {
    id: 'tools',
    name: 'Connected tools',
    detail: 'mail / calendar / agents',
    status: 'attached',
  },
] as const

const workspaceTabs = ['Timeline', 'Memory', 'Tools', 'Files'] as const
type WorkspaceTab = (typeof workspaceTabs)[number]
type WriteStatus = 'pending' | 'approved' | 'edited' | 'rejected'

const pendingWrites = [
  {
    id: 'decision',
    label: 'Decision',
    copy: 'Reschedule weekly review to Thursday after Luca confirms travel.',
  },
  {
    id: 'memory',
    label: 'Memory write',
    copy: 'Prefers compact agenda summaries with exact source links.',
  },
] as const
type PendingWriteId = (typeof pendingWrites)[number]['id']

const initialWriteStatuses: Record<PendingWriteId, WriteStatus> = {
  decision: 'pending',
  memory: 'pending',
}

const executionLog = [
  {
    id: 'calendar',
    time: '09:08',
    label: 'Calendar checked',
  },
  {
    id: 'mail',
    time: '09:11',
    label: 'Reply drafted',
  },
  {
    id: 'approval',
    time: '09:14',
    label: 'Awaiting approval',
  },
] as const

const fileReferences = [
  {
    id: 'agenda',
    name: 'meeting-notes.md',
    detail: '2 citations used',
  },
  {
    id: 'thread',
    name: 'luca-follow-up.eml',
    detail: 'reply context',
  },
] as const

const heroLoopWords = [
  'side',
  'box',
  'line',
  'source',
  'last',
  'na.me',
] as const

const delegationCards = {
  calendar: {
    eyebrow: 'Tool',
    title: 'Calendar',
    detail: 'Find the open slot, respect working hours, then propose the move.',
    status: 'scheduled',
  },
  mail: {
    eyebrow: 'Tool',
    title: 'Email',
    detail:
      'Draft the reply with context from the agent memory and recent work.',
    status: 'drafted',
  },
  files: {
    eyebrow: 'Tool',
    title: 'Files',
    detail: 'Read the source material and attach the exact references used.',
    status: 'indexed',
  },
  researcher: {
    eyebrow: 'Sub-agent',
    title: 'Researcher',
    detail:
      'Spin out a focused agent, collect findings, then return the brief.',
    status: 'delegated',
  },
} as const

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 42 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.82,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}

const staggerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
    },
  },
}

export function LandingHomePage() {
  const heroRef = useRef<HTMLElement>(null)
  const shouldReduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const visualY = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [0, 0] : [0, 112]
  )
  const orbitY = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [0, 0] : [0, -72]
  )

  return (
    <main className="relative isolate overflow-x-clip bg-background text-foreground">
      <div
        aria-hidden
        className="swiss-grid-pattern pointer-events-none absolute inset-0 -z-10 opacity-80"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 -z-10 h-168 w-2xl translate-x-1/3 rounded-full bg-accent/10"
      />

      <LandingNav />

      <section
        className="relative min-h-dvh px-4 pt-24 pb-20 sm:px-6 sm:pt-28 md:px-10 lg:px-12"
        ref={heroRef}
      >
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:min-h-[calc(100dvh-7rem)] lg:grid-cols-[minmax(0,1fr)_minmax(22rem,36rem)] lg:items-end lg:gap-14">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0 max-w-5xl"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="swiss-label mb-5 text-accent">
              <span>OUT</span>
              <span aria-hidden>
                <TextLoop
                  className="ml-1"
                  interval={1.8}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  trigger={!shouldReduceMotion}
                >
                  {heroLoopWords.map((word) => (
                    <span key={word}>{word}</span>
                  ))}
                </TextLoop>
              </span>
            </p>
            <h1 className="max-w-[11ch] text-wrap font-black font-serif text-[clamp(2.65rem,12vw,4.6rem)] uppercase leading-[0.82] tracking-tighter sm:text-[clamp(3.4rem,12vw,5.8rem)] md:max-w-[10ch] md:text-[clamp(4.9rem,10vw,7.2rem)] xl:max-w-none xl:text-[clamp(5.8rem,9vw,8.5rem)]">
              Agents that work outside the chat box.
            </h1>
            <div className="mt-10 grid min-w-0 gap-8 border-foreground border-t-4 pt-6 lg:grid-cols-[minmax(0,42rem)_auto] lg:items-start">
              <div className="min-w-0">
                <h2 className="text-balance font-black font-serif text-4xl uppercase leading-[0.86] tracking-tighter md:text-5xl">
                  Memory, tools, schedule, and follow-through in one workspace.
                </h2>
                <p className="mt-5 text-pretty text-lg leading-relaxed md:text-xl">
                  OUTNA.ME lets you create personal agents that remember
                  context, run on schedule, use your tools, and come back with
                  finished work instead of another thread to manage.
                </p>
              </div>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row lg:justify-end">
                <PrimaryLink href="/login?from=/dashboard">
                  Create your first agent
                </PrimaryLink>
                <SecondaryLink href="#architecture">
                  See how OUTNA.ME works
                </SecondaryLink>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="relative w-full min-w-0 max-w-xl lg:ml-auto"
            style={{ y: visualY }}
          >
            <motion.div
              aria-hidden
              className="absolute -top-14 -left-8 hidden h-40 w-40 border-2 border-foreground bg-background md:block"
              style={{ y: orbitY }}
            >
              <div className="grid h-full place-items-center">
                <div className="size-16 border-4 border-accent" />
              </div>
            </motion.div>
            <HeroConsole shouldReduceMotion={shouldReduceMotion} />
          </motion.div>
        </div>
      </section>

      <section
        className="px-4 py-24 sm:px-6 md:px-10 md:py-32 lg:px-12"
        id="architecture"
      >
        <motion.div
          className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr]"
          initial={shouldReduceMotion ? false : 'hidden'}
          variants={staggerVariants}
          viewport={{ once: true, margin: '-90px' }}
          whileInView="visible"
        >
          <motion.div
            className="border-foreground border-t-4 pt-6"
            variants={revealVariants}
          >
            <p className="swiss-label text-accent">01. Give agents a place</p>
            <h2 className="mt-6 text-balance font-black font-serif text-5xl uppercase leading-[0.84] tracking-tighter md:text-7xl">
              Give each agent memory, tools, and a working rhythm.
            </h2>
            <p className="mt-8 max-w-lg text-pretty text-base text-muted-foreground leading-relaxed">
              Most AI assistants forget the job when the tab closes. OUTNA.ME
              gives each agent a durable workspace: what it knows, what it can
              do, when it should check in, and what it changed.
            </p>
          </motion.div>

          <motion.div
            className="grid gap-4 md:grid-cols-2"
            variants={staggerVariants}
          >
            {featureCards.map((feature) => (
              <motion.article
                className="group border-2 border-foreground bg-background p-2 transition-[transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1"
                key={feature.id}
                variants={revealVariants}
                whileHover={shouldReduceMotion ? undefined : { y: -6 }}
              >
                <div className="flex min-h-full flex-col border border-foreground/15 bg-muted p-6 md:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <p className="swiss-label text-accent">{feature.eyebrow}</p>
                    <span className="border border-foreground bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
                      {feature.signal}
                    </span>
                  </div>
                  <h3 className="mt-10 text-balance font-black font-serif text-3xl uppercase leading-[0.9] tracking-tighter">
                    {feature.title}
                  </h3>
                  <p className="mt-5 text-muted-foreground text-sm leading-relaxed">
                    {feature.body}
                  </p>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </motion.div>
      </section>

      <DelegationRevealSection shouldReduceMotion={shouldReduceMotion} />

      <section className="px-4 py-24 sm:px-6 md:px-10 md:py-36 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
          <motion.div
            className="lg:sticky lg:top-12 lg:self-start"
            initial={shouldReduceMotion ? false : 'hidden'}
            variants={revealVariants}
            viewport={{ once: true, margin: '-90px' }}
            whileInView="visible"
          >
            <p className="swiss-label text-accent">03. Event choreography</p>
            <h2 className="mt-6 text-balance font-black font-serif text-5xl uppercase leading-[0.84] tracking-tighter md:text-7xl">
              From request to follow-up, every step has a record.
            </h2>
            <p className="mt-8 max-w-md text-muted-foreground leading-relaxed">
              OUTNA.ME keeps the work traceable. You can see what triggered the
              agent, which context it used, which tools it called, and what it
              wrote back for next time.
            </p>
          </motion.div>

          <motion.div
            className="border-2 border-foreground bg-background p-2"
            initial={shouldReduceMotion ? false : 'hidden'}
            variants={staggerVariants}
            viewport={{ once: true, margin: '-80px' }}
            whileInView="visible"
          >
            <div className="swiss-diagonal border border-foreground/15 bg-muted p-4 md:p-8">
              <div className="grid gap-4">
                {timelineItems.map((item) => (
                  <motion.article
                    className="grid gap-4 border-2 border-foreground bg-background p-5 md:grid-cols-[5rem_minmax(0,1fr)_8rem] md:items-center md:p-6"
                    key={item.id}
                    variants={revealVariants}
                  >
                    <p className="font-mono text-muted-foreground text-xs">
                      {item.time}
                    </p>
                    <div>
                      <h3 className="font-black text-2xl uppercase leading-none tracking-tighter">
                        {item.label}
                      </h3>
                      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                        {item.copy}
                      </p>
                    </div>
                    <div
                      aria-hidden
                      className="flex items-center gap-2 md:justify-end"
                    >
                      <span className="h-2 flex-1 bg-foreground md:w-14 md:flex-none" />
                      <span className="size-3 bg-accent" />
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6 md:px-10 md:py-36 lg:px-12">
        <motion.div
          className="mx-auto max-w-7xl"
          initial={shouldReduceMotion ? false : 'hidden'}
          variants={staggerVariants}
          viewport={{ once: true, margin: '-90px' }}
          whileInView="visible"
        >
          <motion.div
            className="grid gap-8 border-foreground border-t-4 pt-6 md:grid-cols-[minmax(0,0.9fr)_minmax(18rem,0.55fr)] md:items-start"
            variants={revealVariants}
          >
            <div>
              <p className="swiss-label text-accent">04. Application surface</p>
              <h2 className="mt-6 text-balance font-black font-serif text-5xl uppercase leading-[0.84] tracking-tighter md:text-8xl">
                Inspect the work. Edit the memory. Approve the changes.
              </h2>
            </div>
            <p className="text-pretty text-base text-muted-foreground leading-relaxed">
              OUTNA.ME is built for people who want capable agents without blind
              automation. Review files, timelines, chats, settings, run results,
              pending writes, and the exact tools an agent used.
            </p>
          </motion.div>

          <InteractiveWorkspaceSurface />
        </motion.div>
      </section>

      <section className="px-4 pt-10 pb-24 sm:px-6 md:px-10 md:pb-36 lg:px-12">
        <motion.div
          className="mx-auto max-w-7xl border-4 border-foreground bg-background p-6 md:p-10"
          initial={shouldReduceMotion ? false : 'hidden'}
          variants={revealVariants}
          viewport={{ once: true, margin: '-90px' }}
          whileInView="visible"
        >
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <p className="swiss-label text-accent">05. Start controlled</p>
              <h2 className="mt-6 max-w-4xl text-balance font-black font-serif text-5xl uppercase leading-[0.84] tracking-tighter md:text-8xl">
                Build an agent you can trust tomorrow morning.
              </h2>
              <p className="mt-8 max-w-2xl text-lg text-muted-foreground leading-relaxed">
                Start with one agent, one schedule, and one set of tools.
                OUTNA.ME keeps the work visible while the agent learns how you
                operate.
              </p>
            </div>
            <PrimaryLink href="/login?from=/agents/new">
              Create your first agent
            </PrimaryLink>
          </div>
        </motion.div>
      </section>
    </main>
  )
}

function InteractiveWorkspaceSurface() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('Timeline')
  const [selectedWriteId, setSelectedWriteId] =
    useState<PendingWriteId>('decision')
  const [writeStatuses, setWriteStatuses] =
    useState<Record<PendingWriteId, WriteStatus>>(initialWriteStatuses)

  const selectedWrite =
    pendingWrites.find((write) => write.id === selectedWriteId) ??
    pendingWrites[0]
  const selectedStatus = writeStatuses[selectedWrite.id]
  const updateSelectedWrite = (status: WriteStatus) => {
    setWriteStatuses((currentStatuses) => ({
      ...currentStatuses,
      [selectedWrite.id]: status,
    }))
  }

  return (
    <motion.div
      className="mt-12 grid gap-4 lg:grid-cols-[1.18fr_0.82fr]"
      variants={staggerVariants}
    >
      <motion.div
        className="border-2 border-foreground bg-foreground p-2 text-background"
        variants={revealVariants}
      >
        <div className="min-h-112 border border-background/20 bg-foreground p-4 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-background border-b-2 pb-5">
            <div>
              <p className="swiss-label text-accent">OUTNA.ME workspace</p>
              <h3 className="mt-3 font-black font-serif text-4xl uppercase leading-[0.86] tracking-tighter md:text-6xl">
                Morning operator
              </h3>
            </div>
            <p className="border border-background/35 px-3 py-2 font-mono text-[10px] text-background/70 uppercase tracking-[0.14em]">
              heartbeat +30m
            </p>
          </div>

          <div
            aria-label="Workspace panels"
            className="mt-6 flex flex-wrap gap-2 border-background/25 border-b pb-6"
            role="tablist"
          >
            {workspaceTabs.map((tab) => (
              <button
                aria-selected={activeTab === tab}
                className={
                  activeTab === tab
                    ? 'bg-background px-3 py-2 font-bold text-[10px] text-foreground uppercase tracking-[0.16em] transition-colors duration-200 ease-out'
                    : 'border border-background/25 px-3 py-2 font-bold text-[10px] text-background/65 uppercase tracking-[0.16em] transition-colors duration-200 ease-out hover:border-background hover:text-background'
                }
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          <WorkspaceTabPanel
            activeTab={activeTab}
            selectedWriteId={selectedWriteId}
            setSelectedWriteId={setSelectedWriteId}
            writeStatuses={writeStatuses}
          />
        </div>
      </motion.div>

      <motion.div className="grid gap-4" variants={staggerVariants}>
        <motion.div
          className="border-2 border-foreground bg-background p-6 md:p-7"
          variants={revealVariants}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="swiss-label text-accent">Memory diff</p>
            <span
              className={`border border-foreground px-2 py-1 font-bold text-[10px] uppercase tracking-[0.14em] ${getWriteStatusClass(
                selectedStatus
              )}`}
            >
              {selectedStatus}
            </span>
          </div>
          <p className="mt-8 font-black font-serif text-5xl uppercase leading-[0.86] tracking-tighter md:text-6xl">
            {selectedWrite.copy}
          </p>
          <div className="mt-8 grid gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
            <p className="border border-foreground p-3">
              + selected: {selectedWrite.label}
            </p>
            <p className="border border-foreground bg-muted p-3">
              + state: {selectedStatus}
            </p>
          </div>
        </motion.div>
        <motion.div
          className="border-2 border-foreground bg-accent p-6 md:p-7"
          variants={revealVariants}
        >
          <p className="swiss-label">Approval rail</p>
          <p className="mt-8 font-black font-serif text-5xl uppercase leading-[0.86] tracking-tighter md:text-6xl">
            Choose what happens to this write.
          </p>
          <div className="mt-8 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {(['approved', 'edited', 'rejected'] as const).map((status) => (
              <button
                className="border-2 border-foreground bg-background px-4 py-3 font-black text-[10px] uppercase tracking-[0.16em] transition-[transform,background-color,color] duration-200 ease-out hover:bg-foreground hover:text-background active:scale-[0.98]"
                key={status}
                onClick={() => updateSelectedWrite(status)}
                type="button"
              >
                {status}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

function WorkspaceTabPanel({
  activeTab,
  selectedWriteId,
  setSelectedWriteId,
  writeStatuses,
}: {
  activeTab: WorkspaceTab
  selectedWriteId: PendingWriteId
  setSelectedWriteId: (id: PendingWriteId) => void
  writeStatuses: Record<PendingWriteId, WriteStatus>
}) {
  if (activeTab === 'Memory') {
    return (
      <div className="mt-8 grid gap-4" role="tabpanel">
        {pendingWrites.map((write) => (
          <button
            className={
              selectedWriteId === write.id
                ? 'border border-background bg-background p-4 text-left text-foreground'
                : 'border border-background/25 p-4 text-left text-background transition-colors duration-200 ease-out hover:border-background'
            }
            key={write.id}
            onClick={() => setSelectedWriteId(write.id)}
            type="button"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="swiss-label text-accent">{write.label}</p>
              <span
                className={`border px-2 py-1 font-bold text-[10px] uppercase tracking-[0.14em] ${
                  selectedWriteId === write.id
                    ? 'border-foreground'
                    : 'border-background/35'
                }`}
              >
                {writeStatuses[write.id]}
              </span>
            </div>
            <p className="mt-5 text-pretty font-black text-2xl uppercase leading-none tracking-tighter">
              {write.copy}
            </p>
          </button>
        ))}
      </div>
    )
  }

  if (activeTab === 'Tools') {
    return (
      <div className="mt-8 grid gap-3 sm:grid-cols-2" role="tabpanel">
        {capabilityRows.map((row) => (
          <div className="border border-background/25 p-4" key={row.id}>
            <p className="font-black text-2xl uppercase leading-none tracking-tighter">
              {row.name}
            </p>
            <p className="mt-2 font-mono text-background/60 text-xs">
              {row.detail}
            </p>
            <p className="mt-5 inline-flex bg-background px-2 py-1 font-bold text-[10px] text-foreground uppercase tracking-[0.16em]">
              {row.status}
            </p>
          </div>
        ))}
      </div>
    )
  }

  if (activeTab === 'Files') {
    return (
      <div className="mt-8 grid gap-4 sm:grid-cols-2" role="tabpanel">
        {fileReferences.map((file) => (
          <article
            className="border border-background/25 bg-background p-4 text-foreground"
            key={file.id}
          >
            <p className="swiss-label text-accent">Reference</p>
            <h4 className="mt-5 font-black text-2xl uppercase leading-none tracking-tighter">
              {file.name}
            </h4>
            <p className="mt-3 font-mono text-muted-foreground text-xs uppercase tracking-[0.12em]">
              {file.detail}
            </p>
          </article>
        ))}
      </div>
    )
  }

  return (
    <div
      className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_15rem]"
      role="tabpanel"
    >
      <div className="grid gap-4">
        {pendingWrites.map((write) => (
          <button
            className={
              selectedWriteId === write.id
                ? 'border border-background bg-background p-4 text-left text-foreground'
                : 'border border-background/25 bg-foreground p-4 text-left text-background transition-colors duration-200 ease-out hover:border-background'
            }
            key={write.id}
            onClick={() => setSelectedWriteId(write.id)}
            type="button"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="swiss-label text-accent">{write.label}</p>
              <span
                className={`border px-2 py-1 font-bold text-[10px] uppercase tracking-[0.14em] ${
                  selectedWriteId === write.id
                    ? 'border-foreground'
                    : 'border-background/35'
                }`}
              >
                {writeStatuses[write.id]}
              </span>
            </div>
            <p className="mt-5 text-pretty font-black text-2xl uppercase leading-none tracking-tighter">
              {write.copy}
            </p>
          </button>
        ))}
      </div>

      <aside className="border border-background/25 p-4">
        <p className="swiss-label text-accent">Tool trace</p>
        <div className="mt-5 grid gap-3">
          {executionLog.map((entry) => (
            <div
              className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border border-background/20 p-3"
              key={entry.id}
            >
              <p className="font-mono text-background/60 text-xs">
                {entry.time}
              </p>
              <p className="font-bold text-xs uppercase tracking-[0.12em]">
                {entry.label}
              </p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}

function getWriteStatusClass(status: WriteStatus) {
  if (status === 'approved') {
    return 'bg-foreground text-background'
  }

  if (status === 'rejected') {
    return 'bg-accent text-foreground'
  }

  if (status === 'edited') {
    return 'bg-muted text-foreground'
  }

  return 'bg-background text-foreground'
}

function DelegationRevealSection({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean | null
}) {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })

  const mainScale = useTransform(
    scrollYProgress,
    [0, 0.32, 1],
    shouldReduceMotion ? [1, 1, 1] : [1, 0.96, 0.98]
  )
  const mainY = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [0, 0] : [0, -24]
  )
  const calendarX = useTransform(
    scrollYProgress,
    [0, 0.2, 0.62],
    shouldReduceMotion ? [-292, -292, -292] : [0, -96, -292]
  )
  const calendarY = useTransform(
    scrollYProgress,
    [0, 0.2, 0.62],
    shouldReduceMotion ? [-112, -112, -112] : [0, -28, -112]
  )
  const calendarRotate = useTransform(
    scrollYProgress,
    [0, 0.62],
    shouldReduceMotion ? [-8, -8] : [0, -8]
  )
  const mailX = useTransform(
    scrollYProgress,
    [0, 0.28, 0.72],
    shouldReduceMotion ? [304, 304, 304] : [0, 88, 304]
  )
  const mailY = useTransform(
    scrollYProgress,
    [0, 0.28, 0.72],
    shouldReduceMotion ? [-86, -86, -86] : [0, -20, -86]
  )
  const mailRotate = useTransform(
    scrollYProgress,
    [0, 0.72],
    shouldReduceMotion ? [7, 7] : [0, 7]
  )
  const filesX = useTransform(
    scrollYProgress,
    [0, 0.36, 0.82],
    shouldReduceMotion ? [-224, -224, -224] : [0, -52, -224]
  )
  const filesY = useTransform(
    scrollYProgress,
    [0, 0.36, 0.82],
    shouldReduceMotion ? [166, 166, 166] : [0, 50, 166]
  )
  const filesRotate = useTransform(
    scrollYProgress,
    [0, 0.82],
    shouldReduceMotion ? [6, 6] : [0, 6]
  )
  const researcherX = useTransform(
    scrollYProgress,
    [0, 0.42, 0.9],
    shouldReduceMotion ? [250, 250, 250] : [0, 58, 250]
  )
  const researcherY = useTransform(
    scrollYProgress,
    [0, 0.42, 0.9],
    shouldReduceMotion ? [172, 172, 172] : [0, 48, 172]
  )
  const researcherRotate = useTransform(
    scrollYProgress,
    [0, 0.9],
    shouldReduceMotion ? [-5, -5] : [0, -5]
  )
  const firstOpacity = useTransform(
    scrollYProgress,
    [0, 0.16, 0.28],
    shouldReduceMotion ? [1, 1, 1] : [0, 0, 1]
  )
  const secondOpacity = useTransform(
    scrollYProgress,
    [0, 0.24, 0.38],
    shouldReduceMotion ? [1, 1, 1] : [0, 0, 1]
  )
  const thirdOpacity = useTransform(
    scrollYProgress,
    [0, 0.32, 0.48],
    shouldReduceMotion ? [1, 1, 1] : [0, 0, 1]
  )
  const fourthOpacity = useTransform(
    scrollYProgress,
    [0, 0.4, 0.56],
    shouldReduceMotion ? [1, 1, 1] : [0, 0, 1]
  )

  return (
    <section
      className="px-4 py-24 sm:px-6 md:px-10 lg:px-12 lg:py-0"
      ref={sectionRef}
    >
      <div className="mx-auto grid max-w-7xl gap-10 border-foreground border-t-4 pt-6 xl:hidden">
        <DelegationIntro />
        <MobileDelegationMap />
      </div>

      <div className="mx-auto hidden h-[300vh] max-w-7xl xl:block">
        <div className="sticky top-0 grid h-dvh gap-10 overflow-hidden border-foreground border-t-4 pt-6 md:grid-cols-[minmax(18rem,0.66fr)_minmax(0,1.34fr)] md:items-center">
          <motion.div
            initial={shouldReduceMotion ? false : 'hidden'}
            variants={revealVariants}
            viewport={{ once: true, margin: '-90px' }}
            whileInView="visible"
          >
            <DelegationIntro />
          </motion.div>

          <div className="relative overflow-hidden border-2 border-foreground bg-background p-2">
            <div className="swiss-diagonal relative min-h-176 border border-foreground/15 bg-muted p-4 md:min-h-168">
              <div
                aria-hidden
                className="absolute inset-x-6 top-1/2 h-1 bg-foreground/10"
              />
              <div
                aria-hidden
                className="absolute top-8 bottom-8 left-1/2 w-1 bg-foreground/10"
              />

              <motion.article
                className="absolute top-[calc(50%-10rem)] left-[calc(50%-10rem)] z-30 w-80 border-4 border-foreground bg-background p-2 shadow-[12px_12px_0_#000]"
                style={{ scale: mainScale, y: mainY }}
              >
                <div className="border border-foreground/15 bg-background p-6">
                  <div className="flex items-start justify-between gap-4 border-foreground border-b-2 pb-5">
                    <div>
                      <p className="swiss-label text-accent">Main agent</p>
                      <h3 className="mt-3 font-black font-serif text-4xl uppercase leading-[0.86] tracking-tighter">
                        Operator
                      </h3>
                    </div>
                    <span className="grid size-14 place-items-center border-2 border-foreground bg-accent font-black text-xl">
                      01
                    </span>
                  </div>
                  <p className="mt-6 text-muted-foreground text-sm leading-relaxed">
                    Owns the goal, memory, approvals, and final response.
                  </p>
                  <div className="mt-6 grid gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
                    <div className="flex justify-between border border-foreground p-2">
                      <span>Context</span>
                      <span>locked</span>
                    </div>
                    <div className="flex justify-between border border-foreground bg-foreground p-2 text-background">
                      <span>Thread</span>
                      <span>active</span>
                    </div>
                  </div>
                </div>
              </motion.article>

              <motion.article
                className="absolute top-[calc(50%-8rem)] left-[calc(50%-8rem)] z-20 w-64 border-2 border-foreground bg-background p-2"
                style={{
                  opacity: firstOpacity,
                  rotate: calendarRotate,
                  x: calendarX,
                  y: calendarY,
                }}
              >
                <DelegationCardContent card={delegationCards.calendar} />
              </motion.article>

              <motion.article
                className="absolute top-[calc(50%-8rem)] left-[calc(50%-8rem)] z-20 w-64 border-2 border-foreground bg-background p-2"
                style={{
                  opacity: secondOpacity,
                  rotate: mailRotate,
                  x: mailX,
                  y: mailY,
                }}
              >
                <DelegationCardContent card={delegationCards.mail} />
              </motion.article>

              <motion.article
                className="absolute top-[calc(50%-8rem)] left-[calc(50%-8rem)] z-10 w-64 border-2 border-foreground bg-background p-2"
                style={{
                  opacity: thirdOpacity,
                  rotate: filesRotate,
                  x: filesX,
                  y: filesY,
                }}
              >
                <DelegationCardContent card={delegationCards.files} />
              </motion.article>

              <motion.article
                className="absolute top-[calc(50%-8rem)] left-[calc(50%-8rem)] z-10 w-64 border-2 border-foreground bg-accent p-2"
                style={{
                  opacity: fourthOpacity,
                  rotate: researcherRotate,
                  x: researcherX,
                  y: researcherY,
                }}
              >
                <DelegationCardContent card={delegationCards.researcher} />
              </motion.article>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DelegationIntro() {
  return (
    <div>
      <p className="swiss-label text-accent">02. Delegation map</p>
      <h2 className="mt-6 text-balance font-black font-serif text-5xl uppercase leading-[0.84] tracking-tighter md:text-7xl">
        One agent stays in charge while tools and sub-agents move around it.
      </h2>
      <p className="mt-8 max-w-md text-muted-foreground leading-relaxed">
        The main agent keeps the thread while specialized tools and helper
        agents do their narrow job, then report back into the same workspace.
      </p>
    </div>
  )
}

function MobileDelegationMap() {
  return (
    <div className="relative overflow-hidden border-2 border-foreground bg-background p-2">
      <div className="swiss-diagonal border border-foreground/15 bg-muted p-4">
        <article className="border-4 border-foreground bg-background p-2 shadow-[8px_8px_0_#000]">
          <div className="border border-foreground/15 bg-background p-5">
            <div className="flex items-start justify-between gap-4 border-foreground border-b-2 pb-5">
              <div>
                <p className="swiss-label text-accent">Main agent</p>
                <h3 className="mt-3 font-black font-serif text-4xl uppercase leading-[0.86] tracking-tighter">
                  Operator
                </h3>
              </div>
              <span className="grid size-12 shrink-0 place-items-center border-2 border-foreground bg-accent font-black text-lg">
                01
              </span>
            </div>
            <p className="mt-5 text-muted-foreground text-sm leading-relaxed">
              Owns the goal, memory, approvals, and final response.
            </p>
          </div>
        </article>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Object.values(delegationCards).map((card) => (
            <article
              className="border-2 border-foreground bg-background p-2"
              key={card.title}
            >
              <DelegationCardContent card={card} />
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

function DelegationCardContent({
  card,
}: {
  card: (typeof delegationCards)[keyof typeof delegationCards]
}) {
  return (
    <div className="min-h-48 border border-foreground/15 bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="swiss-label text-accent">{card.eyebrow}</p>
        <span className="border border-foreground px-2 py-1 font-bold text-[10px] uppercase tracking-[0.14em]">
          {card.status}
        </span>
      </div>
      <h3 className="mt-8 font-black font-serif text-3xl uppercase leading-[0.86] tracking-tighter">
        {card.title}
      </h3>
      <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
        {card.detail}
      </p>
    </div>
  )
}

function LandingNav() {
  return (
    <header className="absolute top-0 right-0 left-0 z-10 px-4 pt-5 sm:px-6 md:px-10 lg:px-12">
      <nav
        aria-label="Home"
        className="mx-auto flex w-full min-w-0 max-w-7xl items-center justify-between gap-4 border-2 border-foreground bg-background p-2"
      >
        <Link
          className="flex min-h-11 min-w-0 items-center gap-3 px-3 font-black text-sm uppercase tracking-[0.22em] transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-accent"
          href="/"
        >
          <span aria-hidden className="size-3 bg-accent" />
          OUTNA.ME
        </Link>
        <div className="hidden items-center gap-1 lg:flex">
          <NavLink href="#architecture">How it works</NavLink>
          <NavLink href="/login?from=/dashboard">Login</NavLink>
        </div>
      </nav>
    </header>
  )
}

function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      className="px-4 py-3 font-bold text-[10px] uppercase tracking-[0.18em] transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-foreground hover:text-background"
      href={href}
    >
      {children}
    </Link>
  )
}

function PrimaryLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      className="group inline-flex min-h-14 w-full items-center justify-center gap-4 border-2 border-foreground bg-foreground py-2 pr-2 pl-6 font-bold text-background text-xs uppercase tracking-[0.16em] transition-[transform,background-color,color,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-accent hover:bg-accent hover:text-foreground active:scale-[0.98] sm:w-auto"
      href={href}
    >
      {children}
      <span
        aria-hidden
        className="grid size-10 place-items-center bg-background text-foreground transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1 group-hover:-translate-y-0.5"
      >
        →
      </span>
    </Link>
  )
}

function SecondaryLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      className="inline-flex min-h-14 w-full items-center justify-center border-2 border-foreground bg-background px-6 font-bold text-xs uppercase tracking-[0.16em] transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-foreground hover:text-background active:scale-[0.98] sm:w-auto"
      href={href}
    >
      {children}
    </Link>
  )
}

function HeroConsole({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean | null
}) {
  return (
    <div className="relative border-2 border-foreground bg-background p-2">
      <div className="border border-foreground/15 bg-muted p-4 md:p-6">
        <div className="flex items-center justify-between gap-4 border-foreground border-b-2 pb-4">
          <div>
            <p className="swiss-label text-accent">Live agent</p>
            <h2 className="mt-2 font-black text-2xl uppercase leading-none tracking-tighter">
              Morning operator
            </h2>
          </div>
          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    rotate: [0, 4, -3, 0],
                    y: [0, -5, 2, 0],
                  }
            }
            className="grid size-16 place-items-center border-2 border-foreground bg-background"
            transition={{
              duration: 7,
              ease: [0.16, 1, 0.3, 1],
              repeat: Number.POSITIVE_INFINITY,
              repeatDelay: 0.8,
            }}
          >
            <span className="size-5 bg-accent" />
          </motion.div>
        </div>

        <div className="mt-6 grid gap-3">
          {capabilityRows.map((row) => (
            <div
              className="grid grid-cols-[1fr_auto] gap-4 border-2 border-foreground bg-background p-4"
              key={row.id}
            >
              <div>
                <p className="font-black text-lg uppercase leading-none tracking-tighter">
                  {row.name}
                </p>
                <p className="mt-1 font-mono text-muted-foreground text-xs">
                  {row.detail}
                </p>
              </div>
              <span className="self-start bg-accent px-2 py-1 font-bold text-[10px] uppercase tracking-[0.14em]">
                {row.status}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 border-2 border-foreground bg-foreground p-4 text-background">
          <div className="flex items-center justify-between gap-4">
            <p className="swiss-label text-accent">Next event</p>
            <p className="font-mono text-background/70 text-xs">
              heartbeat +30m
            </p>
          </div>
          <p className="text-pretty font-black font-serif text-4xl uppercase leading-[0.86] tracking-tighter">
            Check calendar, draft follow-up, update memory.
          </p>
        </div>
      </div>
    </div>
  )
}
