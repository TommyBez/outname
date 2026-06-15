# Product Marketing Context

*Last updated: 2026-06-15*

> Positioning: **SaaS-first**. Open source is real and worth saying — as trust, inspectability, and a contribution path that can expand the hosted product. Do not treat open source as a synonym for self-hosted.

## Code-Derived Claim Hygiene
| Status | Safe to claim | Do not claim without more verification |
|--------|---------------|----------------------------------------|
| Shipped / code-backed | Browser chat, authenticated dashboard, agent registry, guided agent creation, manual configuration, persistent sandbox files, scheduled heartbeat/dreaming events, durable invocation events, event ledger, Slack ingress/routing when enabled, attached maintainer tools, sub-agents, installed skills, budget rules, token usage ledger, waitlist/invite/OTP access, dedicated `maintainer-tool-implementation` skill in the repo | Production reliability, customer outcomes, paid billing, native channels beyond browser chat and Slack, automatic acceptance or hosting of community PRs |
| Tool surface | Resend email, Cal.com scheduling, GitHub repo workspace, Typefully, X, PostHog, Firecrawl, Context7, Parallel, Vercel, Supabase, v0, browser automation | Native Gmail inbox, native calendar inbox, email as a runtime channel, calendar as a runtime channel |
| Demo / illustrative | Landing chat showcase, heartbeat-day animation, composability visual, launch social content | Live telemetry, customer proof, production metrics, shipped Telegram/Discord/webhook channels |
| Roadmap / unverified | Telegram, Discord, generic webhooks, email inbound channel, broader channel plugins, complete workflow/sandbox USD COGS ledger, paid tiers | Public copy that implies these are available today |

## Product Overview
**One-liner:** Personal AI agents that keep working — hosted, with readable memory, schedules, tools, and sandboxed execution.

**What it does:** OUTNA.ME is a hosted product for creating personal AI agents with their own role, model, schedule, readable memory files, tools, sub-agents, skills, and runtime surfaces. The shipped product supports browser chat, scheduled heartbeat/dreaming runs, durable workflow-backed events, persistent Vercel Sandbox files, attached maintainer tools, sub-agent delegation, installed agent skills, budgets, and Slack ingress/routing when enabled. Agents do not "learn" automatically in an abstract sense; future runs improve only when useful context is saved into readable sandbox files, logs, or bootstrap memory that later prompts can include. The codebase is open source (MIT) so builders can inspect the stack and contribute new maintainer tools that may become available in the hosted product after review and merge. Self-hosting or private deployment should be treated as a separate deployment question, not as the definition of open source.

**Product category:** Personal AI agents; autonomous agent system; recurring-work automation for knowledge work.

**Product type:** Hosted SaaS product, backed by an open-source codebase.

**Business model:** SaaS-first, early-access/waitlist motion. The codebase does not include billing, checkout, subscriptions, or a pricing page. Terms copy says early access may be offered without charge or with experimental pricing before paid plans are introduced. Inference is user-provided: users save personal inference provider credentials instead of OUTNA.ME relying on a server fallback key. "BYOK" is useful technical shorthand, but public product copy should usually say "use your own inference provider key." Open source supports trust, technical adoption, and contribution to the hosted capability layer; it should not be framed as shorthand for self-hosting.

## Pricing & Packaging
**Current model:** Early access through waitlist/invite flow. Sign-up is disabled; provisioned users sign in with email OTP. There is no shipped billing or paid-plan implementation in the codebase. Non-admin users currently have a creation limit of 3 agents.

**Beta rationale:** Keep access curated while validating recurring agent workflows, onboarding, reliability, provider-key setup, and willingness to pay before publishing paid tiers. Do not describe this as a permanent free plan or freemium promise.

**Inference cost model:** User-provided inference credentials. Supported inference provider paths are Vercel AI Gateway, LLM Gateway, and OpenRouter. Users must save an enabled provider key before creating/running agents on that provider. Model usage is tracked internally through token usage and cost estimates/actuals where available.

**Current enforced limits and guardrails:**
- non-admin users can create up to 3 agents
- heartbeat interval is clamped between 5 and 1440 minutes
- daily scheduled heartbeat mode accepts 1 to 8 `HH:mm` times
- step limits exist for low, medium, high, custom, and grind modes
- sub-agent invocation has depth and cycle/self-call protections
- user and per-agent budget rules can stop runs once configured USD limits are exceeded
- Slack access is permission/env gated

**Primary future value metric hypothesis:** Active agents plus execution capacity. The value does not scale cleanly with seats or raw model tokens; it scales with how many agents can keep working, how often they run, what tools they can use, whether Slack is enabled, and how much hosted runtime/sandbox/workflow capacity the product manages for the user.

**Future packaging guardrails hypothesis:** Future paid tiers should be shaped around understandable operating limits:
- active or creatable agents
- scheduled runs / heartbeats per month
- minimum schedule interval
- maximum run duration
- concurrent runs
- tool and sandbox runtime
- memory and retention
- connected runtime channels, starting with Slack
- attached tools, skills, and connector-backed capabilities
- team controls, audit, support, and onboarding

**Internal cost stance:** The shipped ledger covers model/token usage and estimated/actual USD model costs where available. Workflow, sandbox, Redis, Slack, and tool-runtime costs are real COGS drivers but are not currently represented as a full per-run/user-month infrastructure cost ledger. Treat workflow/sandbox COGS accounting as an operating need before paid packaging, not as shipped functionality.

**Cost risks to control:** The main infrastructure risk is not only model tokens under user-provided inference credentials. It is also hosted execution: scheduled run frequency, durable workflow activity, sandbox wall-clock time, skill/tool sandbox usage, sub-agent fan-out, concurrency, Slack fan-out, Redis/cache usage, and snapshot/storage retention.

**Pricing implication:** Future paid pricing should charge for the hosted agent operating layer: agents, scheduled execution, sandboxed runtime, readable memory, tools, skills, Slack/channel runtime, policy, budgets, and support. OUTNA.ME should not initially position itself as a reseller of model tokens.

**Likely future packaging hypothesis:**
- **Builder:** Individual users with a small number of personal agents, capped scheduled runs, one-run-at-a-time execution, user-provided inference credentials, and basic tools plus browser chat/Slack where enabled. The current beta limit of 3 agents is a useful baseline for this entry tier.
- **Pro:** Founder-operators and power users who need more agents, higher run limits, richer memory/files, more tool/sandbox capacity, and more runtime surfaces as they ship.
- **Team / Business:** Shared workspaces, policy controls, auditability, higher concurrency and retention, priority support, and business-grade onboarding.

## Target Audience
**Primary ICP:** Technical solo founders, founder-operators, developers, and AI-native builders who already use AI tools, have recurring operational work, and are willing to configure agents, tools, memory files, schedules, provider keys, and integrations to get leverage.

**Target companies:** The current audience is more role-based than company-based. Best current fit: solo builders and small early-stage teams where one technical operator owns product, growth, operations, and follow-up work.

**Waitlist profile options in product:** Developer, founder/operator, product/design, technical leader, and other. This is the cleanest code-backed audience signal.

**Secondary audiences:** Technical leaders who need reliable follow-through, product/design operators who want agent-assisted workflows, developers who want inspectable agent infrastructure without wiring everything from scratch, and small technical teams exploring agent-based internal operations.

**Decision-makers:** Founder-operators, technical founders, C-level operators, and developers who want more continuity and control over how agents run — without becoming infra operators.

**Primary use case:** Launch and operate personal agents in a hosted control plane, without running the whole agent stack yourself, to keep recurring work moving through browser chat, scheduled runs, Slack routing where enabled, persistent memory files, attached tools, skills, and sub-agents.

**Jobs to be done:**
- Let me go from idea to working autonomous agent without stitching together multiple tools and runtimes.
- Help me promote and operate my own product through recurring communication and marketing work.
- Give me useful daily output without forcing me to manage the machine or infrastructure myself.

**Shipped / code-backed use cases:**
- Guided agent creation through chat, with review before the agent is saved.
- Browser chat with persistent conversations.
- Scheduled heartbeat and dreaming runs that continue work without a live prompt.
- Manual event triggers that use the durable event workflow.
- Slack ingress/routing when Slack access and env configuration are enabled.
- Readable memory/files/logs in persistent Vercel Sandboxes.
- Tool-assisted work through attached maintainer tools such as Resend, Cal.com, GitHub repo workspace, Typefully, X, PostHog, Firecrawl, Context7, Parallel, Vercel, Supabase, v0, and browser automation.
- Sub-agent delegation to another user-owned agent with depth/cycle protections.
- Agent skills installed into a separate persistent skill sandbox.
- Budget monitoring and run blocking based on configured USD budget rules.

**Use cases that need careful wording:** Morning triage, email, calendar, cold outreach, social publishing, and lead generation can be discussed as tool-assisted workflows only when the relevant tool/provider is configured. Do not imply native Gmail inbox, native calendar inbox, Telegram, Discord, generic webhook, or email-channel runtime unless those are verified as shipped.

**Not the initial ICP:** Non-technical consumers looking for a polished personal chatbot, large enterprise buyers who require procurement/security review before trying the product, and users who primarily want a no-configuration assistant with bundled model usage.

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Technical solo founder / founder-operator | Leverage, continuity, speed, control | Context is scattered across notes, Slack, code, launch work, and follow-ups; small tasks stay open too long | A hosted agent system that keeps recurring work moving while staying configurable and inspectable |
| Technical leader / operator | Visibility, follow-through, and less operational overhead | Important recurring work depends too much on manual follow-up and fragmented tools | Agents with schedules, event history, budgets, and readable memory instead of opaque one-off chats |
| Developer / technical builder | Control, inspectability, modularity | Generic assistants feel opaque, too broad, and hard to shape around real workflows | A hosted agent runtime with persistent files, tools, sub-agents, skills, schedules, sandboxes, and open-source inspectability |

## Problems & Pain Points
**Core problem:** People want autonomous agents, but setting them up across different platforms is still too complex, and the recurring work they want automated keeps depending on manual follow-through.

**Why alternatives fall short:**
- Generic assistants are too broad and not shaped for recurring operational roles.
- One giant agent becomes hard to understand, tune, and trust.
- Multi-platform agent setups are painful to configure and maintain.
- Self-managed solutions often require the user to run and maintain their own machine or environment.
- Manual systems across notes, chat, and calendar require constant context reconstruction.
- Traditional automations and agent frameworks can support memory, delegation, and recurring work, but users often still need to design, host, connect, and maintain those pieces themselves.
- Bundled-token AI products can make model spend opaque; technical users often want provider choice and cost control.

**What it costs them:** Missed follow-ups, slower execution, repeated setup work, fragmented knowledge, infrastructure overhead, and less confidence that important work is actually progressing.

**Emotional tension:** Low-grade stress, the feeling that too many things remain "open", and frustration from rebuilding context over and over.

## Competitive Landscape
**Source discipline:** Named competitor claims are not inferable from this codebase. Use this section as internal positioning only, and re-verify against current official competitor sources before publishing comparison pages, SEO content, or objection handling.

**Direct:** Hosted personal-agent products and open-source personal-agent workbenches are the closest alternatives. OpenClaw and Paperclip are verified named competitors to track. OpenClaw positions itself as a personal AI assistant that takes real actions such as clearing inboxes, sending emails, managing calendars, and working from chat apps. Paperclip positions itself as an open-source app/control plane for managing teams of AI agents at work, with org charts, goals, budgets, governance, heartbeats, ticketing, cost tracking, and bring-your-own-agent support. Do not claim either product lacks agent identity, memory/state, delegation, scheduled/autonomous execution, cost controls, or operational workflows unless a specific claim has been re-verified against current sources. The defensible OUTNA.ME distinction is SaaS-first personal-agent packaging: hosted personal agents, browser app onboarding, managed schedules/workflows/sandboxes, readable per-agent memory, user-controlled inference provider choice, and less emphasis on self-hosting, local machine ownership, or managing an agent-company org chart.

**Secondary:** Claude and other general-purpose AI copilots. They fall short when users need continuity, reusable memory, recurring execution, and operational output rather than primarily prompt-response interaction.

**Adjacent:** Automation and orchestration tools such as workflow builders, cron jobs, scripts, agent frameworks, and integration platforms. Do not claim these categories lack agents, memory, delegation, or evolving context by default: many now include AI agents, memory nodes/stores, nested agent workflows, and subgraph/sub-agent patterns. OUTNA.ME should differentiate on the packaged product experience: hosted personal agents with clear roles, readable per-agent memory, schedules, sandboxed state, user-controlled inference provider choice, and a SaaS-first setup path for recurring work.

**Indirect:** Manual personal systems: notes, reminders, Slack, calendar, inbox, and ad hoc follow-ups. They fall short because the human has to keep stitching context back together.

**Competitive research gap:** This section should be refreshed with current research before publishing comparison pages, objection handling against named competitors, or SEO content. Avoid blanket category claims unless verified against current official product docs.

## Differentiation
**Key differentiators:**
- Hosted SaaS experience — fast time-to-value without running your own stack.
- Composable agent configuration — tools and sub-agents attach explicitly; skills install into a separate skill sandbox; memory lives as readable persistent files; Slack bindings route external messages when enabled.
- Configurable agents instead of one generic assistant.
- Scheduled heartbeat/dreaming runs and durable workflow-backed event execution.
- File-based memory designed to be read, edited, and reused across future runs.
- Maintainer tools, sub-agents, skills, browser chat, and Slack routing in one control plane.
- Open-source extension loop — if a maintainer tool is missing, technical users can implement it in the repo, open a PR, and, after review and merge, that capability can become part of the hosted product.
- Dedicated maintainer-tool implementation skill in the repo to guide contributors through the expected tool architecture and validation path.
- Persistent system sandbox per agent, separate skill sandbox for installed skills, and transient tool/repo/broker sandboxes for specific runtime work.
- User-provided inference credentials with multiple gateway options: Vercel AI Gateway, LLM Gateway, and OpenRouter.
- Token usage/cost estimates and configurable budget guardrails, without pretending budget is billing.
- Open-source codebase (MIT) for inspectability and contribution — credibility without making self-hosting part of the default pitch.

**How we do it differently:** OUTNA.ME treats each agent as a small operational unit with a clear role, provider/model selection, bootstrap files, schedule, tools, sub-agent attachments, skills, budgets, and event history. The product is designed to reduce the setup burden of autonomous agents and deliver a hosted, productized environment — not a pile of components users must wire and maintain themselves. Open source is not in tension with the hosted product: it is the contribution surface for improving the hosted capability layer, especially maintainer tools.

**Why that's better:** Users get faster time-to-value, clearer responsibilities per agent, better reuse of context over time, and less infrastructure burden — while technical users still have a path to inspect, extend, and contribute missing capabilities back to the hosted product.

**Why customers choose us:** They want recurring agent work that persists across days, browser chat, Slack where enabled, files, tools, and scheduled events, but they do not want to become operators of their own agent stack just to get there.

**Do not overclaim:** Do not claim native runtime channels beyond browser chat and Slack unless verified. Do not claim automatic learning, vector memory, all integrations, unlimited autonomy, or a complete workflow/sandbox USD cost ledger.

## Objections
| Objection | Response |
|-----------|----------|
| "This feels early." | It is early, and the current ask is early access. That is a good fit for builders who want to shape the product and see progress closely. |
| "I already have ChatGPT / Claude." | OUTNA.ME is not positioned as a better chat window; it is a hosted system for recurring work that needs memory, schedules, tools, and continuity across runs. |
| "Why would I not just use Openclaw or Paperclip?" | OUTNA.ME is SaaS-first: less setup friction, hosted infra, and faster path to agents that keep running — without managing your own machine or runtime. |
| "I do not want one big autonomous agent touching everything." | That is exactly the design principle: small configurable agents with clear scopes, explicit tools, readable files, and specific runtime surfaces rather than one giant assistant. |
| "Why would I use the hosted product if it's open source?" | Hosted is the default experience; open source is the trust and contribution layer. Open source does not mean the product is primarily self-hosted. Users get managed schedules, sandboxes, workflows, and integrations now, while technical contributors can inspect and improve the product surface. |
| "Is this just a wrapper around open-source tooling?" | No. OUTNA.ME is a productized agent runtime: hosted execution, persistent sandboxes, scheduled workflows, readable files, browser chat, Slack routing when enabled, tools, skills, and sub-agents in one coherent system. The repo proves what you're buying into. |
| "What if the tool I need is missing?" | The maintainer tool layer is open source. Technical users can implement a missing tool in the repo, use the `maintainer-tool-implementation` skill as guidance, and open a PR. Be precise: review and merge are required before it can become part of the hosted product. |
| "Why do I need to bring my own model key?" | The current product requires user-provided inference credentials. That gives users provider choice and model-spend visibility, but it is a setup step; do not hide that friction. |
| "Is early access the same as a free plan?" | No. The shipped flow is waitlist/invite/OTP access, and the codebase has no billing or pricing-page implementation yet. Future paid plans remain a packaging hypothesis. |
| "Will this get expensive or unpredictable?" | Users can configure daily/weekly/monthly budget rules for model spend, and token usage is tracked. Be precise: this is not a billing guarantee and does not yet account for every workflow/sandbox/tool-provider COGS line. |
| "Why not unlimited agents?" | The current non-admin limit is 3 agents. Agents carry real hosted execution, memory, sandbox, tool, and support costs; limits keep early access controlled and create a path to paid packaging. |
| "Which channels actually work today?" | Be precise. Current product proof is strongest around browser chat, Slack ingress/routing, scheduled runs, persistent memory, tool attachments, and sandboxed execution. Email, calendar, Discord, Telegram, and webhooks can be discussed as tool surfaces, demos, or roadmap only when their shipped status is clear. |
| "Is Slack available to everyone?" | Not necessarily. Slack runtime exists, but access and setup are gated by user permission and environment configuration. |
| "Are the landing demos live product data?" | No. The landing chat and heartbeat scenes are static illustrative demos. They are useful for messaging, not proof of production usage, customer outcomes, or shipped native Gmail/calendar channels. |

**Anti-persona:** People looking for a polished consumer chatbot, one-off prompt help, or a free self-host project with no interest in a hosted product or recurring operational work.

## Switching Dynamics
**Push:** Tasks stay open too long; follow-ups slip; context is spread across tools; repeated prompting and manual checking waste attention; and current autonomous-agent setups are too annoying to get running.

**Pull:** A hosted product where agents keep working, reuse readable context, run on schedules, use tools, delegate to sub-agents, operate through browser chat and Slack when enabled, and keep files/event history visible — with fast setup and optional open-source transparency.

**Habit:** Existing workflows rely on manual reminders, generic AI chats, self-managed tools, and personal memory to keep work moving.

**Anxiety:** Trusting agents with real recurring work, setting up the right scopes and tools, and adopting an early-stage product before proof is fully established. Open source reduces black-box anxiety for technical buyers; the waitlist/onboarding path reduces infra anxiety for everyone else.

## Customer Language
**Founder/problem language from launch content, not customer quotes:**
- "Some things start staying open for too long."
- "I need a system that can come back to certain pieces of work even when I'm not there pushing them manually."
- "An idea of product scattered between notes, Slack, calendar, and code."
- "The problem was not 'I need a better answer.'"
- "The small, repeated steps that require continuity."
- "Memory only matters if it prevents rebuilding the same context every time."

**How to describe the product based on shipped code:**
- "Agents that keep working."
- "Hosted personal AI agents with readable memory files, schedules, tools, sub-agents, skills, and sandboxed execution."
- "Small agents with explicit role, model, schedule, memory seeds, tools, budget, and event history."
- "Browser chat, scheduled runs, persistent files, attached tools, and Slack routing when enabled."
- "Use your own inference provider key."
- "Hosted for getting agents running without operating the stack yourself; open source for inspecting and extending the capability layer."
- "Open source describes code access, license, and contribution model; self-hosting is a separate deployment model."
- "If the maintainer tool you need is missing, implement it, open a PR, and it can become part of the hosted product after review and merge."

**Landing copy already in use:**
- "Agents that keep working."
- "They remember. They learn. They call other agents. Every run sharpens the next."
- "An agent is what you attach to it."
- "The agent is a shell. Capabilities snap into named slots."
- "It runs while you sleep. It learns while it runs."

**Landing/demo caveat:** "They learn" and "Every run sharpens the next" should be interpreted concretely: runs can update readable memory/log files that later prompts can reuse. Landing demos are static illustrative scenes, not live product telemetry.

**Candidate pricing language to test:**
- "Use your own inference provider key. OUTNA.ME runs the agents."
- "Pay for the hosted agent layer, not a bundled-token black box." (future pricing hypothesis, not shipped pricing page)

**Words to use:** hosted, personal AI agents, recurring work, continuity, configurable agents, composable agent configuration, attached tools, bound Slack routing, traced sub-agent calls, installed skills, scheduled runs, heartbeat, dreaming, future runs, readable memory files, persistent sandbox, browser chat, Slack when enabled, early access, waitlist, invite-only, user-provided inference provider key, provider choice, hosted agent runtime, operating layer, execution capacity, runtime limits, Vercel AI Gateway, LLM Gateway, OpenRouter, open source as trust and contribution layer, community-extensible tool layer, maintainer tool PRs, review and merge.

**Words to avoid:** generic assistant, one giant agent, AI magic, memory as a buzzword, chatbot replacement, free forever, freemium promise, unlimited agents, bundled-token black box, DIY-only, self-host first, open source as shorthand for self-hosted, every channel, all integrations, native Gmail inbox, native calendar channel, Telegram/Discord/webhooks as shipped, fully autonomous employee, automatic learning, automatic PR acceptance, instant hosted support for any contributed tool.

**Glossary:**
| Term | Meaning |
|------|---------|
| Heartbeat | A scheduled autonomous run that fires without a live human prompt |
| Memory | Readable sandbox files, logs, and bootstrap context that can be included in later prompts; not automatic learning |
| Sub-agent | A specialist agent called by a parent agent for a bounded task |
| Agent configuration | The configurable container for an agent's role, model, bootstrap files, schedule, tools, sub-agents, skills, budgets, and Slack bindings |
| Attached capability | A maintainer tool, sub-agent, or skill made available to a specific agent |
| Bound tool | A scoped tool attachment that the agent may call because the user explicitly attached it |
| Runtime surface | A place where an agent can interact directly. Current shipped claims should emphasize browser chat and Slack, with Slack access gated by permissions/env |
| Tool surface | A capability the agent can call, such as Resend email, Cal.com scheduling, browser automation, developer tools, social tools, or other configured maintainer tools |
| Scheduled run | An agent execution triggered by time or recurring cadence |
| System sandbox | Persistent per-agent Vercel Sandbox that stores readable agent files |
| Skill sandbox | Separate persistent Vercel Sandbox for installed skills and skill script execution |
| Tool sandbox | Transient or snapshot-backed sandbox used by specific tools/runtime providers |
| BYOK | Internal shorthand for user-provided inference credentials; public copy should prefer "use your own inference provider key" |
| Inference provider | The gateway or model access layer used for agent runs, such as Vercel AI Gateway, LLM Gateway, or OpenRouter |
| Hosted agent runtime | The OUTNA.ME-managed execution layer that runs agents, schedules, tools, sandboxes, memory, browser chat, and Slack routing when enabled |
| Execution capacity | The practical usage envelope of a plan: run frequency, duration, concurrency, sandbox/tool usage, and retention |
| Budget | User-defined operational guardrail for model spend; not billing, invoice, or a financial guarantee |
| Cost ledger | Shipped for model/token usage; broader workflow/sandbox COGS ledger is an operating need, not a shipped pricing feature |
| Open-source extension loop | The hosted product is the default experience, while the public repo gives technical users a path to implement missing maintainer tools and propose them for the hosted product through PR review |
| Maintainer-tool implementation skill | Repo skill named `maintainer-tool-implementation` that guides contributors through the expected architecture for adding a new maintainer tool |
| Open source (MIT) | The codebase is public under an open-source license; this supports inspection, contribution, and forkability, but does not by itself define the product as self-hosted |
| Self-hosting / private deployment | A deployment and licensing/distribution question separate from source availability. Open-source products may or may not support it well; closed-source products can also offer private or self-hosted deployments |

## Brand Voice
**Tone:** Direct, grounded, technical, and anti-hype.

**Style:** Plainspoken, concrete, operational. Lead with the hosted product and outcomes; mention open source as credibility and contribution surface for builders. Keep open source distinct from self-hosting.

**Personality:** Sharp, practical, composable, calm, technical.

## Proof Points
**Metrics:** No public performance or customer metrics are documented in the repo yet. Needs confirmation.

**Customers:** Founder/problem narrative exists in launch content. Early-access waitlist exists. Named customers, logos, testimonials, reliability benchmarks, conversion, retention, and revenue metrics are not documented in code.

**Code-backed product evidence:**
- Public landing page, waitlist page, waitlist confirmation, support, privacy, terms, and blog routes exist.
- Waitlist captures email, name, profile type, primary interest, use case, UTM/source/referrer metadata, and confirmation/provisioning state.
- Sign-up is disabled; provisioned users sign in with email OTP codes.
- Authenticated app includes dashboard, agent registry, private agent workspaces, channels, connections, settings, and waitlist admin for authorized users.
- Guided agent creation chat can produce a reviewed `create_requested_agent` tool call before saving.
- Agents persist provider/model, step limit, heartbeat schedule, dreaming toggle, enabled/paused state, and sandbox ids.
- Agent bootstrap files include `AGENTS.md`, `IDENTITY.md`, `SOUL.md`, and `USER.md`; memory UI exposes files, timeline, and dreaming output.
- Durable event types are `heartbeat`, `dreaming`, and `invocation`, with statuses such as queued, starting, running, completed, failed, and cancelled.
- Scheduler uses cron plus Redis lock to enqueue due heartbeat/dreaming events and recover expired/stale events.
- Browser chat runs through realtime `ToolLoopAgent` and persists conversations/messages.
- Slack OAuth/events/routing/bindings exist, but access and setup are gated.
- Maintainer tool catalog includes Resend, Cal.com, Context7, Firecrawl, GitHub repo workspace, Parallel, PostHog, browser tools, X, Typefully, Vercel, Supabase, and v0.
- Sub-agent delegation is implemented as an attached tool with depth/cycle/self-call protections.
- Agent skills install into a separate persistent skill sandbox with skill and bash tool support.
- Budget rules and token usage ledger exist for model spend guardrails and visibility.

**Demo/static evidence, not production proof:**
- Landing chat showcase is hardcoded/static.
- Heartbeat day stats/events are hardcoded/static.
- Landing/demo references to Gmail, calendar, email inbound, Slack/email/webhook channels, Telegram, Discord, or webhooks are not proof of shipped runtime channels.

**Open-source proof:**
- MIT-licensed codebase in repo
- Deploy-on-Vercel path documented in README
- Support page states the product is open source; GitHub is linked in site footer
- Repo includes a `maintainer-tool-implementation` skill for adding new maintainer tools according to the codebase's connector/tool architecture
- Community PRs can expand the hosted maintainer-tool layer after review and merge; do not imply automatic acceptance or immediate hosted availability
- Canonical repository URL: `https://github.com/TommyBez/outname`.

**Testimonials:**
> No customer testimonials documented yet. Needs confirmation.

**Value themes:**
| Theme | Proof |
|-------|-------|
| Continuity over novelty | Core copy focuses on work that keeps moving across days, not one-off answers |
| Hosted speed over agent-stack complexity | SaaS-first positioning vs multi-platform self-managed setup |
| Configurable autonomy | Agents are small operational units with model, identity, schedule, and memory |
| Composability | Tool attachments, sub-agent rows, skill installation, and Slack bindings are explicit product concepts |
| Channel precision | Runtime code provides strongest shipped proof around browser chat and Slack ingress/routing; other channels need verification |
| Learning over time | Readable sandbox memory/log files can persist useful context for later prompts |
| Provider choice | Users can connect Vercel AI Gateway, LLM Gateway, or OpenRouter instead of being locked to one model path |
| Cost control without token resale | User-provided inference credentials plus budget rules/token usage keep model spend visible |
| Trust without black box | Open-source codebase backs the hosted product; inspect, fork, and contribute without making self-hosting the primary story |
| Community-extensible capabilities | Missing maintainer tools can be proposed through PRs, with the repo's `maintainer-tool-implementation` skill guiding the expected development path |

## Goals
**Business goal:** Build early demand and validate OUTNA.ME as the faster, SaaS-first way to get personal agents running for recurring work. Use early-access usage to validate onboarding, provider-key setup, scheduled-run reliability, Slack/tool workflows, budget guardrails, willingness to pay, and hosted-runtime unit economics before publishing paid tiers.

**Conversion action:** Join the waitlist / request early access to the hosted product. GitHub star/fork is secondary discovery, not the primary CTA.

**Current metrics:** Waitlist exists and signups are tracked in-product, but no public benchmark numbers are documented in the repo. Needs confirmation.

## Messaging hierarchy (SaaS-first)
1. **Lead:** Agents that keep working — hosted, with readable memory, schedules, and tools.
2. **Mechanism:** An agent is what you configure: role, model, readable files, schedule, tools, sub-agents, skills, budgets, and Slack bindings when enabled.
3. **Support:** Faster than stitching together self-managed agent stacks.
4. **Control:** Use your own inference provider key — Vercel AI Gateway, LLM Gateway, or OpenRouter.
5. **Extension:** Hosted by default, open source at the capability layer: missing maintainer tools can be implemented and proposed for the hosted product through PR review.
6. **Packaging:** Future pricing should charge for hosted agent operating capacity, not a bundled-token black box.
7. **Proof:** Open source (MIT) — inspect the stack, contribute tools, fork if you want, no black box; do not collapse this into a self-hosting claim.
8. **CTA:** Join the waitlist / request early access.
