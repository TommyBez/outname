# Product Marketing Context

*Last updated: 2026-06-02*

> Positioning: **SaaS-first**. Open source is real and worth saying — but as trust, inspectability, and optional ownership — not as the primary pitch or CTA.

## Product Overview
**One-liner:** Personal AI agents that keep working — hosted, with memory, schedules, tools, and sandboxed execution.

**What it does:** OUTNA.ME is a hosted product for creating personal AI agents with their own role, schedule, memory, tools, and channels. Agents run autonomously on schedules, call sub-agents, work across operational channels, and improve future runs by saving useful context instead of starting from zero every time. The codebase is open source (MIT) for builders who want to inspect, fork, or self-deploy — but the default path is the hosted experience.

**Product category:** Personal AI agents; autonomous agent system; recurring-work automation for knowledge work.

**Product type:** Hosted SaaS product, backed by an open-source codebase.

**Business model:** SaaS-first. Early-access waitlist today. Open source supports trust and technical adoption; it is not the primary conversion path.

## Target Audience
**Target companies:** The current audience is more role-based than company-based. Best current fit: solo builders, C-level operators, and developers, especially in small teams or early-stage environments.

**Decision-makers:** Solo builders, founders, C-levels, and developers who want more continuity and control over how agents run — without becoming infra operators.

**Primary use case:** Launch autonomous agents quickly on a hosted product, without painful cross-platform setup, to keep recurring communication, marketing, scheduling, and outreach work moving.

**Jobs to be done:**
- Let me go from idea to working autonomous agent without stitching together multiple tools and runtimes.
- Help me promote and operate my own product through recurring communication and marketing work.
- Give me useful daily output without forcing me to manage the machine or infrastructure myself.

**Use cases:**
- Morning triage across Slack, email, and calendar.
- Daily or weekly reports and operational recaps.
- Social media management and publishing support.
- Appointment and schedule management.
- Cold outreach and lead generation support.
- Research synthesis and comparison across time windows.
- Follow-up capture and resurfacing.
- Scheduled "heartbeat" runs that continue work without a live prompt.

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Solo builder / founder-operator | Continuity, leverage, fewer dropped balls | Context is scattered across notes, Slack, calendar, and code; small tasks stay open too long | A hosted agent system that keeps work moving even when attention shifts |
| C-level operator | Visibility, follow-through, and less operational overhead | Important recurring work depends too much on manual follow-up and fragmented tools | Agents that keep key workflows moving without requiring constant executive attention |
| Developer / technical builder | Control, inspectability, modularity | Generic assistants feel opaque, too broad, and hard to shape around real workflows | Configurable hosted agents with tools, memory, sub-agents, schedules, and sandboxed execution — inspectable via open source |

## Problems & Pain Points
**Core problem:** People want autonomous agents, but setting them up across different platforms is still too complex, and the recurring work they want automated keeps depending on manual follow-through.

**Why alternatives fall short:**
- Generic assistants are too broad and not shaped for recurring operational roles.
- One giant agent becomes hard to understand, tune, and trust.
- Multi-platform agent setups are painful to configure and maintain.
- Self-managed solutions often require the user to run and maintain their own machine or environment.
- Manual systems across notes, chat, and calendar require constant context reconstruction.
- Traditional automations can trigger actions, but they do not preserve and reuse nuanced working context well.

**What it costs them:** Missed follow-ups, slower execution, repeated setup work, fragmented knowledge, infrastructure overhead, and less confidence that important work is actually progressing.

**Emotional tension:** Low-grade stress, the feeling that too many things remain "open", and frustration from rebuilding context over and over.

## Competitive Landscape
**Direct:** Openclaw and Paperclip are the clearest named alternatives right now. They fall short for this positioning when setup is slower, the experience is less SaaS-like, or the user has to manage their own machine or runtime environment.

**Secondary:** Claude and other general-purpose AI copilots. They fall short when users need continuity, reusable memory, recurring execution, and operational output rather than primarily prompt-response interaction.

**Indirect:** Manual personal systems: notes, reminders, Slack, calendar, inbox, and ad hoc follow-ups. They fall short because the human has to keep stitching context back together.

## Differentiation
**Key differentiators:**
- Hosted SaaS experience — fast time-to-value without running your own stack.
- Configurable agents instead of one generic assistant.
- Scheduled runs and heartbeat-style autonomous execution.
- Memory designed for future runs, not just transcript storage.
- Tools, sub-agents, and channel integrations in one system.
- Sandboxed execution with persistent agent state.
- Open-source codebase (MIT) for inspectability and optional self-deployment — credibility without making self-host the default path.

**How we do it differently:** OUTNA.ME treats each agent as a small operational unit with a clear role, memory reference, schedule, tools, and channels. The product is designed to reduce the setup burden of autonomous agents and deliver a hosted, productized environment — not a pile of components users must wire and maintain themselves. Open source sits underneath as proof you can inspect and own the stack if you want to; the hosted product is what most people should start with.

**Why that's better:** Users get faster time-to-value, clearer responsibilities per agent, better reuse of context over time, and less infrastructure burden — with optional transparency for technical buyers.

**Why customers choose us:** They want autonomous work that persists across days, channels, and recurring tasks, but they do not want to become operators of their own agent stack just to get there.

## Objections
| Objection | Response |
|-----------|----------|
| "This feels early." | It is early, and the current ask is early access. That is a good fit for builders who want to shape the product and see progress closely. |
| "I already have ChatGPT / Claude." | OUTNA.ME is not positioned as a better chat window; it is a hosted system for recurring work that needs memory, schedules, tools, and continuity across runs. |
| "Why would I not just use Openclaw or Paperclip?" | OUTNA.ME is SaaS-first: less setup friction, hosted infra, and faster path to agents that keep running — without managing your own machine or runtime. |
| "I do not want one big autonomous agent touching everything." | That is exactly the design principle: small configurable agents with clear scopes, tools, and channels rather than one giant assistant. |
| "Why would I use the hosted product if it's open source?" | Open source is for inspectability, contribution, and optional self-deploy. The hosted product is for people who want agents running now — schedules, sandboxes, workflows, and integrations managed for them. |
| "Is this just a wrapper around open-source tooling?" | No. OUTNA.ME is a productized agent runtime: hosted execution, persistent sandboxes, scheduled workflows, memory, channels, and tools in one coherent system. The repo proves what you're buying into. |

**Anti-persona:** People looking for a polished consumer chatbot, one-off prompt help, or a free self-host project with no interest in a hosted product or recurring operational work.

## Switching Dynamics
**Push:** Tasks stay open too long; follow-ups slip; context is spread across tools; repeated prompting and manual checking waste attention; and current autonomous-agent setups are too annoying to get running.

**Pull:** A hosted product where agents keep working, remember useful context, run on schedules, use tools, and operate in the channels where work already happens — with fast setup and optional open-source transparency.

**Habit:** Existing workflows rely on manual reminders, generic AI chats, self-managed tools, and personal memory to keep work moving.

**Anxiety:** Trusting agents with real recurring work, setting up the right scopes and tools, and adopting an early-stage product before proof is fully established. Open source reduces black-box anxiety for technical buyers; the waitlist/onboarding path reduces infra anxiety for everyone else.

## Customer Language
**How they describe the problem:**
- "Some things start staying open for too long."
- "I need a system that can come back to certain pieces of work even when I'm not there pushing them manually."
- "An idea of product scattered between notes, Slack, calendar, and code."
- "The problem was not 'I need a better answer.'"
- "I need autonomous agents for solo work."
- "Everyone talks about autonomous agents, but setup across different platforms is a mess."

**How they describe us:**
- "Agents that keep working."
- "Hosted personal AI agents with memory, schedules, tools, and sandboxed execution."
- "Small agents that can run on a schedule, use tools, work through channels, call sub-agents, remember useful context, and come back to recurring work."
- "Memory that improves future runs."
- "You can inspect the code if you want — but I just use the hosted product."

**Words to use:** hosted, personal AI agents, recurring work, continuity, configurable agents, scheduled runs, future runs, memory, tools, sub-agents, channels, early access, autonomous, open source (as proof/trust, not headline).

**Words to avoid:** generic assistant, one giant agent, AI magic, memory as a buzzword, chatbot replacement, free forever, DIY-only, self-host first.

**Glossary:**
| Term | Meaning |
|------|---------|
| Heartbeat | A scheduled autonomous run that fires without a live human prompt |
| Memory | Saved context that improves later runs, not a dump of everything |
| Sub-agent | A specialist agent called by a parent agent for a bounded task |
| Channel plugin | A runtime surface like Slack, Telegram, Discord, email, or webhook |
| Scheduled run | An agent execution triggered by time or recurring cadence |
| Sandboxed execution | Isolated runtime state for agent work and persistent files |
| Open source (MIT) | The codebase is public and forkable; the default product experience remains hosted SaaS |

## Brand Voice
**Tone:** Direct, grounded, technical, and anti-hype.

**Style:** Plainspoken, concrete, operational. Lead with the hosted product and outcomes; mention open source as credibility for builders, not as the main hook.

**Personality:** Sharp, practical, composable, calm, technical.

## Proof Points
**Metrics:** No public performance or customer metrics are documented in the repo yet. Needs confirmation.

**Customers:** Founder dogfooding is explicit. Early-access waitlist exists. Named customers/logos are not yet documented.

**Open-source proof:**
- MIT-licensed codebase on GitHub (`github.com/TommyBez/outname`)
- Deploy-on-Vercel path documented in README
- Support page states the product is open source; GitHub linked in site footer

**Testimonials:**
> No customer testimonials documented yet. Needs confirmation.

**Value themes:**
| Theme | Proof |
|-------|-------|
| Continuity over novelty | Core copy focuses on work that keeps moving across days, not one-off answers |
| Hosted speed over agent-stack complexity | SaaS-first positioning vs multi-platform self-managed setup |
| Configurable autonomy | Agents are small operational units with model, identity, schedule, and memory |
| Composability | Tools, sub-agents, channels, MCP, and skills are core product building blocks |
| Learning over time | Memory is framed as improving future runs |
| Trust without black box | Open-source codebase backs the hosted product; inspect, fork, or self-deploy if needed |

## Goals
**Business goal:** Build early demand and validate OUTNA.ME as the faster, SaaS-first way to get autonomous agents running for recurring communication, marketing, scheduling, and outreach work.

**Conversion action:** Join the waitlist / request early access to the hosted product. GitHub star/fork is secondary discovery, not the primary CTA.

**Current metrics:** Waitlist exists and signups are tracked in-product, but no public benchmark numbers are documented in the repo. Needs confirmation.

## Messaging hierarchy (SaaS-first)
1. **Lead:** Agents that keep working — hosted, with memory, schedules, and tools.
2. **Support:** Faster than stitching together self-managed agent stacks.
3. **Proof:** Open source (MIT) — inspect the stack, fork if you want, no black box.
4. **CTA:** Join the waitlist / get early access to the hosted product.
