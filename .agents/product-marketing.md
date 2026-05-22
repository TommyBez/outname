# Product Marketing Context

*Last updated: 2026-05-22*

> V1 auto-draft from the current codebase, landing page, waitlist flow, README, and launch content. Items marked "Needs confirmation" are inferred and should be reviewed.

## Product Overview
**One-liner:** Personal AI agents that keep working: configurable agents with memory, schedules, tools, and sandboxed execution.

**What it does:** OUTNA.ME lets users create personal AI agents with their own role, schedule, memory, tools, and channels. Those agents can run autonomously, call sub-agents, work across chat and operational channels, and improve future runs by saving useful context instead of starting from zero every time.

**Product category:** Personal AI agents; autonomous agent system; recurring-work automation for knowledge work.

**Product type:** Hybrid product: hosted SaaS experience plus an open-source codebase.

**Business model:** Hybrid. Open-source distribution plus hosted product. Early-access waitlist today.

## Target Audience
**Target companies:** The current audience is more role-based than company-based. Best current fit: solo builders, C-level operators, and developers, especially in small teams or early-stage environments.

**Decision-makers:** Solo builders, founders, C-levels, and developers who want more continuity and control over how agents run.

**Primary use case:** Launch autonomous agents quickly, without painful cross-platform setup, to keep recurring communication, marketing, scheduling, and outreach work moving.

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
| Solo builder / founder-operator | Continuity, leverage, fewer dropped balls | Context is scattered across notes, Slack, calendar, and code; small tasks stay open too long | A personal agent system that keeps work moving even when attention shifts |
| C-level operator | Visibility, follow-through, and less operational overhead | Important recurring work depends too much on manual follow-up and fragmented tools | Agents that keep key workflows moving without requiring constant executive attention |
| Developer / technical builder | Control, inspectability, modularity | Generic assistants feel opaque, too broad, and hard to shape around real workflows | Configurable agents with tools, memory, sub-agents, schedules, and sandboxed execution |

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
- Configurable agents instead of one generic assistant.
- Faster setup for autonomous agents.
- Scheduled runs and heartbeat-style autonomous execution.
- Memory designed for future runs, not just transcript storage.
- Tools, sub-agents, and channel integrations in one system.
- Sandboxed execution and deployable ownership model.
- SaaS experience instead of requiring users to manage their own machine.
- Builder-friendly, composable architecture.

**How we do it differently:** OUTNA.ME treats each agent as a small operational unit with a clear role, memory reference, schedule, tools, and channels. It is designed to reduce the setup burden of autonomous agents and give users a hosted, productized environment instead of a pile of components they need to wire and maintain themselves.

**Why that's better:** Users get faster time-to-value, more control, clearer responsibilities per agent, better reuse of context over time, and less infrastructure burden.

**Why customers choose us:** They want autonomous work that persists across days, channels, and recurring tasks, but they do not want to become operators of their own agent stack just to get there.

## Objections
| Objection | Response |
|-----------|----------|
| "This feels early." | It is early, and the current ask is early access. That is a good fit for builders who want to shape the product and see progress closely. |
| "I already have ChatGPT / Claude." | OUTNA.ME is not positioned as a better chat window; it is for recurring work that needs memory, schedules, tools, and continuity across runs. |
| "Why would I not just use Openclaw or Paperclip?" | OUTNA.ME aims to reduce setup friction and provide a SaaS experience, so users can get value faster without managing their own machine or runtime. |
| "I do not want one big autonomous agent touching everything." | That is exactly the design principle: small configurable agents with clear scopes, tools, and channels rather than one giant assistant. |

**Anti-persona:** People looking for a polished consumer chatbot, one-off prompt help, or zero-setup automation without caring about control, modularity, or persistent context.

## Switching Dynamics
**Push:** Tasks stay open too long; follow-ups slip; context is spread across tools; repeated prompting and manual checking waste attention; and current autonomous-agent setups are too annoying to get running.

**Pull:** Agents that keep working, remember useful context, run on schedules, use tools, and operate in the channels where work already happens, with a faster SaaS setup.

**Habit:** Existing workflows rely on manual reminders, generic AI chats, self-managed tools, and personal memory to keep work moving.

**Anxiety:** Trusting agents with real recurring work, setting up the right scopes and tools, and adopting an early-stage product before proof is fully established.

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
- "Personal AI agents with readable memory, schedules, tools, and sandboxed execution."
- "Small agents that can run on a schedule, use tools, work through channels, call sub-agents, remember useful context, and come back to recurring work."
- "Memory that improves future runs."

**Words to use:** personal AI agents, recurring work, continuity, configurable agents, scheduled runs, future runs, memory, tools, sub-agents, channels, composable, autonomous.

**Words to avoid:** generic assistant, one giant agent, AI magic, memory as a buzzword, chatbot replacement.

**Glossary:**
| Term | Meaning |
|------|---------|
| Heartbeat | A scheduled autonomous run that fires without a live human prompt |
| Memory | Saved context that improves later runs, not a dump of everything |
| Sub-agent | A specialist agent called by a parent agent for a bounded task |
| Channel plugin | A runtime surface like Slack, Telegram, Discord, email, or webhook |
| Scheduled run | An agent execution triggered by time or recurring cadence |
| Sandboxed execution | Isolated runtime state for agent work and persistent files |

## Brand Voice
**Tone:** Direct, grounded, technical, and anti-hype.

**Style:** Plainspoken, concrete, operational, and builder-first.

**Personality:** Sharp, practical, composable, calm, technical.

## Proof Points
**Metrics:** No public performance or customer metrics are documented in the repo yet. Needs confirmation.

**Customers:** Founder dogfooding is explicit. Early-access waitlist exists. Named customers/logos are not yet documented.

**Testimonials:**
> No customer testimonials documented yet. Needs confirmation.

**Value themes:**
| Theme | Proof |
|-------|-------|
| Continuity over novelty | The core copy focuses on work that keeps moving across days, not one-off answers |
| Fast setup over agent-stack complexity | User input and positioning emphasize that current multi-platform setup is painful |
| Configurable autonomy | Agents are described as small operational units with model, identity, schedule, and memory |
| Composability | Tools, sub-agents, channels, MCP, and skills are all core product building blocks |
| Learning over time | Memory is explicitly framed as improving future runs |
| Ownership and control without self-hosting pain | The system is open-source and composable, but the intended experience is also SaaS and faster to adopt |

## Goals
**Business goal:** Build early demand and validate OUTNA.ME as the faster, SaaS-first way to get autonomous agents running for recurring communication, marketing, scheduling, and outreach work.

**Conversion action:** Join the waitlist / request early access.

**Current metrics:** Waitlist exists and signups are tracked in-product, but no public benchmark numbers are documented in the repo. Needs confirmation.
