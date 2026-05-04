'use client'

import type { LucideIcon } from 'lucide-react'
import {
  ActivityIcon,
  ArrowRightIcon,
  BotIcon,
  BrainIcon,
  CalendarClockIcon,
  CheckIcon,
  FileClockIcon,
  FileTextIcon,
  HammerIcon,
  MailIcon,
  MessagesSquareIcon,
  MousePointerClickIcon,
  NetworkIcon,
  RefreshCwIcon,
  RouteIcon,
  Settings2Icon,
} from 'lucide-react'
import type { Variants } from 'motion/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { TextLoop } from '@/components/motion-primitives/text-loop'

type FeatureId = 'chat' | 'heartbeat' | 'memory' | 'tools' | 'review'
type ToolId = 'resend' | 'calcom' | 'browser' | 'subagent'
type MemoryId = 'identity' | 'instructions' | 'user' | 'logs' | 'dreams'

interface FeatureMode {
  accent: string
  href: string
  icon: LucideIcon
  id: FeatureId
  label: string
  metric: string
  signal: string
  steps: readonly string[]
  title: string
}

interface ToolMode {
  accent: string
  config: readonly string[]
  icon: LucideIcon
  id: ToolId
  label: string
  output: string
  requirement: string
}

interface MemoryFile {
  detail: string
  id: MemoryId
  label: string
  path: string
  tag: string
}

const featureModes: readonly FeatureMode[] = [
  {
    accent: 'bg-accent',
    href: '/login?from=/agents',
    icon: MessagesSquareIcon,
    id: 'chat',
    label: 'Chat',
    metric: 'stream',
    signal: 'the request is saved before the agent starts',
    steps: ['save the request', 'resume the session', 'stream the reply'],
    title: 'Turn conversations into durable agent runs.',
  },
  {
    accent: 'bg-foreground',
    href: '/login?from=/agents/new',
    icon: CalendarClockIcon,
    id: 'heartbeat',
    label: 'Heartbeat',
    metric: '5m-1d',
    signal: 'each tick waits for the previous run',
    steps: ['choose cadence', 'run proactive work', 'recover sessions'],
    title: 'Let agents check in without a prompt.',
  },
  {
    accent: 'bg-accent',
    href: '/login?from=/agents',
    icon: BrainIcon,
    id: 'memory',
    label: 'Memory',
    metric: 'md files',
    signal: 'markdown files are mirrored for review',
    steps: ['seed identity', 'maintain user context', 'mirror logs'],
    title: 'Give every agent readable memory.',
  },
  {
    accent: 'bg-foreground',
    href: '/login?from=/agents',
    icon: HammerIcon,
    id: 'tools',
    label: 'Tools',
    metric: 'catalog',
    signal: 'Resend, Cal.com, browser, and sub-agents',
    steps: ['attach approved tools', 'resolve credentials', 'show failures'],
    title: 'Attach real tools to the right agent.',
  },
  {
    accent: 'bg-accent',
    href: '/login?from=/agents',
    icon: FileClockIcon,
    id: 'review',
    label: 'Review',
    metric: 'diffs',
    signal: 'GOALS.md and TASKS.md changes',
    steps: ['read reflection', 'compare the diff', 'mark reviewed'],
    title: 'Review what the agent learned and changed.',
  },
] as const

const tools: readonly ToolMode[] = [
  {
    accent: 'bg-accent',
    config: ['fromEmail', 'to', 'subject', 'text/html'],
    icon: MailIcon,
    id: 'resend',
    label: 'Resend email',
    output: 'sends through your verified sender',
    requirement: 'Resend API key',
  },
  {
    accent: 'bg-foreground',
    config: ['method', 'path', 'query', 'body'],
    icon: CalendarClockIcon,
    id: 'calcom',
    label: 'Cal.com scheduling',
    output: 'checks slots, bookings, and event types',
    requirement: 'Cal.com API key',
  },
  {
    accent: 'bg-accent',
    config: ['open', 'snapshot', 'click', 'screenshot'],
    icon: MousePointerClickIcon,
    id: 'browser',
    label: 'agent-browser',
    output: 'drives a sandboxed browser session',
    requirement: 'browser tool sandbox',
  },
  {
    accent: 'bg-foreground',
    config: ['agent_<id>', 'instruction', 'final reply'],
    icon: NetworkIcon,
    id: 'subagent',
    label: 'Sub-agent',
    output: 'returns a focused result to the parent',
    requirement: 'another owned agent',
  },
] as const

const memoryFiles: readonly MemoryFile[] = [
  {
    detail: 'Compact persona card seeded from the agent form.',
    id: 'identity',
    label: 'Identity',
    path: 'IDENTITY.md',
    tag: 'bootstrap',
  },
  {
    detail: 'Operating manual used by the session prompt.',
    id: 'instructions',
    label: 'Instructions',
    path: 'AGENTS.md',
    tag: 'user edit',
  },
  {
    detail: 'Stable facts the agent may maintain over time.',
    id: 'user',
    label: 'User profile',
    path: 'USER.md',
    tag: 'agent memory',
  },
  {
    detail: 'Daily event logs mirrored after chat, heartbeat, and reflection.',
    id: 'logs',
    label: 'Timeline',
    path: 'logs/YYYY-MM-DD.md',
    tag: 'mirror',
  },
  {
    detail: 'Reflection output plus GOALS.md and TASKS.md diffs.',
    id: 'dreams',
    label: 'Dreams',
    path: 'DREAMS.md',
    tag: 'review',
  },
] as const

const routeLinks = [
  {
    href: '/login?from=/dashboard',
    icon: ActivityIcon,
    label: 'Dashboard',
    meta: 'monitor agents and sessions',
  },
  {
    href: '/login?from=/agents/new',
    icon: BotIcon,
    label: 'Create agent',
    meta: 'model, memory, cadence',
  },
  {
    href: '/login?from=/agents',
    icon: MessagesSquareIcon,
    label: 'Chat',
    meta: 'talk to a running agent',
  },
  {
    href: '/login?from=/agents',
    icon: FileTextIcon,
    label: 'Memory files',
    meta: 'read mirrored markdown',
  },
  {
    href: '/login?from=/agents',
    icon: HammerIcon,
    label: 'Tools',
    meta: 'attach catalog and sub-agents',
  },
  {
    href: '/login?from=/settings',
    icon: Settings2Icon,
    label: 'Connections',
    meta: 'manage API keys',
  },
] as const

const loopWords = ['chat', 'heartbeat', 'reflection', 'tools', 'files'] as const

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.72,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}

const staggerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: 18 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.32,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -12,
    transition: {
      duration: 0.16,
      ease: [0.4, 0, 1, 1],
    },
  },
}

function featureById(id: FeatureId): FeatureMode {
  return featureModes.find((feature) => feature.id === id) ?? featureModes[0]
}

function toolById(id: ToolId): ToolMode {
  return tools.find((toolMode) => toolMode.id === id) ?? tools[0]
}

function memoryById(id: MemoryId): MemoryFile {
  return memoryFiles.find((file) => file.id === id) ?? memoryFiles[0]
}

export function LandingHomePage() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <main className="relative isolate overflow-x-clip bg-background text-foreground">
      <div
        aria-hidden
        className="swiss-grid-pattern pointer-events-none absolute inset-0 -z-10 opacity-80"
      />
      <LandingNav />

      <section className="relative px-4 pt-24 pb-16 sm:px-6 sm:pt-28 md:px-10 lg:px-12">
        <div className="mx-auto grid w-full max-w-7xl gap-8">
          <div className="grid min-w-0 gap-6 border-foreground border-t-4 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.38fr)] lg:items-end">
            <div className="min-w-0">
              <p className="swiss-label mb-5 text-accent">
                OUTNA.ME /
                <TextLoop
                  className="ml-2 inline-flex"
                  interval={1.7}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  trigger={!shouldReduceMotion}
                >
                  {loopWords.map((word) => (
                    <span key={word}>{word}</span>
                  ))}
                </TextLoop>
              </p>
              <h1 className="home-display max-w-[11ch] text-wrap font-black text-6xl uppercase leading-[0.84] tracking-normal sm:text-7xl md:text-8xl xl:text-9xl">
                Agents with a workbench.
              </h1>
            </div>
            <div className="grid gap-5 lg:border-foreground lg:border-l-2 lg:pl-6">
              <p className="max-w-md text-base leading-relaxed md:text-lg">
                Create private AI agents with memory, schedules, and tools. They
                can chat, wake on a cadence, update markdown files, and leave a
                trace you can inspect.
              </p>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <PrimaryLink href="/login?from=/agents/new">
                  Create agent
                </PrimaryLink>
                <SecondaryLink href="#showcase">See capabilities</SecondaryLink>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <FeatureWorkbench
              shouldReduceMotion={Boolean(shouldReduceMotion)}
            />
          </div>
        </div>
      </section>

      <SurfaceMap shouldReduceMotion={Boolean(shouldReduceMotion)} />
      <ToolShowcase shouldReduceMotion={Boolean(shouldReduceMotion)} />
      <MemoryReviewShowcase shouldReduceMotion={Boolean(shouldReduceMotion)} />
      <FinalCta shouldReduceMotion={Boolean(shouldReduceMotion)} />
    </main>
  )
}

function FeatureWorkbench({
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

function SurfaceMap({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
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
          className="grid gap-5 border-foreground border-t-4 pt-5 md:grid-cols-[minmax(0,0.74fr)_minmax(0,1.26fr)] md:items-end"
          variants={revealVariants}
        >
          <div>
            <p className="swiss-label text-accent">Workspace</p>
            <h2 className="mt-4 text-balance font-black text-5xl uppercase leading-[0.88] tracking-normal md:text-7xl">
              One place to manage every agent.
            </h2>
          </div>
          <p className="max-w-2xl text-muted-foreground leading-relaxed">
            Move from dashboard to chat, memory, tools, and connections without
            losing the thread.
          </p>
        </motion.div>

        <motion.div
          className="mt-8 grid border-foreground border-t-2 md:grid-cols-2 xl:grid-cols-3"
          variants={staggerVariants}
        >
          {routeLinks.map((route) => {
            const Icon = route.icon
            return (
              <motion.div
                className="border-foreground border-r-2 border-b-2 md:nth-[2n]:border-r-0 xl:nth-[2n]:border-r-2 xl:nth-[3n]:border-r-0"
                key={route.label}
                variants={revealVariants}
              >
                <Link
                  className="group ease grid min-h-44 grid-rows-[auto_1fr_auto] bg-background p-5 transition-colors duration-150 hover:bg-foreground hover:text-background"
                  href={route.href}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="size-5" />
                    <ArrowRightIcon className="ease size-4 transition-transform duration-150 group-hover:translate-x-1" />
                  </div>
                  <p className="mt-8 font-black text-3xl uppercase leading-none tracking-normal">
                    {route.label}
                  </p>
                  <p className="mt-5 font-mono text-muted-foreground text-xs uppercase tracking-normal group-hover:text-background/65">
                    {route.meta}
                  </p>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.div>
    </section>
  )
}

function ToolShowcase({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
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

function MemoryReviewShowcase({
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
            and reflection diffs before trusting what changed.
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

function FinalCta({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  return (
    <section className="px-4 pt-10 pb-24 sm:px-6 md:px-10 md:pb-32 lg:px-12">
      <motion.div
        className="mx-auto grid max-w-7xl gap-8 border-4 border-foreground bg-background p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:p-10"
        initial={shouldReduceMotion ? false : 'hidden'}
        variants={revealVariants}
        viewport={{ once: true, margin: '-80px' }}
        whileInView="visible"
      >
        <div>
          <p className="swiss-label text-accent">Build</p>
          <h2 className="mt-4 max-w-4xl text-balance font-black text-5xl uppercase leading-[0.88] tracking-normal md:text-8xl">
            Start with one agent you can inspect.
          </h2>
        </div>
        <PrimaryLink href="/login?from=/agents/new">Create agent</PrimaryLink>
      </motion.div>
    </section>
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
          className="ease flex min-h-11 min-w-0 items-center gap-3 px-3 font-black text-sm uppercase tracking-normal transition-colors duration-150 hover:text-accent"
          href="/"
        >
          <span aria-hidden className="size-3 bg-accent" />
          OUTNA.ME
        </Link>
        <div className="hidden items-center gap-1 sm:flex">
          <NavLink href="#showcase">Capabilities</NavLink>
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
      className="ease inline-flex min-h-11 items-center px-4 font-bold text-xs uppercase tracking-normal transition-colors duration-150 hover:bg-foreground hover:text-background"
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
      className="group ease inline-flex min-h-14 w-full items-center justify-center gap-4 border-2 border-foreground bg-foreground py-2 pr-2 pl-6 font-bold text-background text-xs uppercase tracking-normal transition-[transform,background-color,color,border-color] duration-150 hover:border-accent hover:bg-accent hover:text-foreground active:scale-[0.98] sm:w-auto"
      href={href}
    >
      {children}
      <span
        aria-hidden
        className="ease grid size-10 place-items-center bg-background text-foreground transition-transform duration-150 group-hover:translate-x-1"
      >
        <ArrowRightIcon className="size-4" />
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
      className="ease inline-flex min-h-14 w-full items-center justify-center gap-3 border-2 border-foreground bg-background px-6 font-bold text-xs uppercase tracking-normal transition-[transform,background-color,color] duration-150 hover:bg-foreground hover:text-background active:scale-[0.98] sm:w-auto"
      href={href}
    >
      <RouteIcon className="size-4" />
      {children}
    </Link>
  )
}
