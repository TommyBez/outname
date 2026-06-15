'use client'

import {
  Reveal,
  SectionShell,
} from '@outname/shared/marketing/components/landing/section-kit'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@outname/ui/components/ui/accordion'

const FAQS = [
  {
    q: 'What’s it doing when I’m not watching?',
    a: 'Running on its schedule. A heartbeat fires, the agent picks up where it left off, does the work, writes what matters to its memory files, and logs the run. You read the ledger later — nothing happens off the record.',
  },
  {
    q: 'Can it go off the rails?',
    a: 'It only touches what you hand it — the tools you attach, nothing else. Budget rules cut a run off at a USD limit, sub-agent calls have depth and loop guards, and every event is on the ledger. Small scoped agents, not one assistant holding every key.',
  },
  {
    q: 'Where does its memory actually live?',
    a: 'In plain files in the agent’s own sandbox — AGENTS.md, USER.md, logs, and the rest. Open them, edit them, correct them. No vector store, no black box, no “it learned something, trust us.”',
  },
  {
    q: 'Which models can I run?',
    a: 'Whatever your gateway serves. Add a key for Vercel AI Gateway, OpenRouter, or LLM Gateway and the whole catalog — Anthropic, OpenAI, Google, DeepSeek and the rest — is yours to pick from. You bring the key; we don’t resell tokens.',
  },
  {
    q: 'What does it cost?',
    a: 'Nothing from us yet — early access has no billing. You pay your inference provider for what the agents use, and you cap it with budget rules. Paid plans come later; we won’t spring one on you.',
  },
  {
    q: 'The tool I need isn’t in the list.',
    a: 'Then add it. The tool layer is open source — build it in the repo, open a PR, and once it’s reviewed and merged it’s live in the hosted product. There’s a skill in the repo that walks you through the wiring.',
  },
  {
    q: 'How do I actually get in?',
    a: 'Join the waitlist. Sign-up is closed during early access — once you’re invited you sign in with an email code, and you start with up to three agents.',
  },
] as const

export function Faq() {
  return (
    <SectionShell index="08" label="FAQ" title="Straight answers.">
      <Reveal>
        <Accordion
          className="border-foreground border-t-2"
          collapsible
          defaultValue="faq-0"
          type="single"
        >
          {FAQS.map((faq, index) => (
            <AccordionItem
              className="border-foreground border-b-2"
              key={faq.q}
              value={`faq-${index}`}
            >
              <AccordionTrigger className="py-5 font-bold text-base uppercase tracking-tight hover:no-underline data-[state=open]:text-accent">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </SectionShell>
  )
}
