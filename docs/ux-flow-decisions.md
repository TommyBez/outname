# Application UX flow audit and decisions

This audit treats UX as task completion, orientation, decision support, and recovery—not visual redesign. The chosen improvements deliberately reuse the existing design system classes and component primitives.

## Flow decisions

| User flow | Current friction | Improvement option A | Improvement option B | Chosen improvement |
| --- | --- | --- | --- | --- |
| Sign in and regain access | Users can request an email code but may not know why they landed there or what happens after authentication. | Add more explanatory copy around OTP behavior and redirect destination. | Preserve the focused form and make downstream app pages better at recovering intent after sign-in. | **B** — keep authentication low-friction and improve post-login orientation through dashboard next actions. |
| First-run onboarding | Empty states only say to create an agent, so users do not understand the minimum path to value. | Add a multi-step onboarding wizard. | Add a contextual setup checklist directly in the dashboard empty state. | **B** — checklist gives structure without introducing a blocking wizard. |
| Dashboard monitoring | Metrics exist, but users must infer which problem to handle first. | Add a separate alerts inbox. | Add contextual “next best actions” ranked by risk and setup completeness. | **B** — prioritizes action in the existing dashboard without a new destination. |
| Agent creation | The primary CTA exists, but users may hit plan or access limits without a recovery path. | Hide create actions when unavailable. | Keep the action visible and pair it with settings/support recovery routes. | **B** — visible disabled intent is more informative than disappearing affordances. |
| Agent registry discovery | Search is broad and does not support common operational slices such as active, paused, or setup incomplete. | Add advanced sort/filter controls. | Add lightweight status filters plus a reset path. | **B** — covers frequent scanning tasks without making the registry feel like an admin table. |
| Agent overview triage | Runtime, tools, memory, budget, state, and events are separate panels but do not explain the best next step. | Add inline recommendations inside every panel. | Add one prioritized “Next step” panel before the detailed panels. | **B** — a single recommendation reduces cognitive load and keeps panels factual. |
| Agent chat/run execution | Users can enter chat or trigger runs, but they need confidence that prerequisites are complete. | Block chat until setup is complete. | Surface prerequisites in overview and keep chat reachable. | **B** — avoids blocking expert users while guiding new users. |
| Agent events investigation | Users can open events, but failed work competes with other status signals. | Make events the default landing page when failures exist. | Keep overview default and elevate failures in next-step recommendations. | **B** — preserves navigation predictability while making failures obvious. |
| Agent configuration | Users can change runtime, schedule, budgets, and integrations, but the entry point is not always clear. | Split configuration into separate top-level pages. | Deep-link recommendations to the exact configuration anchors that unblock the user. | **B** — maintains the current information architecture and improves wayfinding. |
| Tools and connections | Users must understand the difference between shared credentials and agent-attached tools. | Merge connections and tools into one page. | Add copy and next actions that route from agent tools to shared connections when needed. | **B** — preserves shared-vs-agent mental model while reducing dead ends. |
| Channels | Users install channel providers globally but bind them per agent, which can be confusing. | Move channel install into every agent. | Keep global install and clarify that agent routing happens in Configure / Integrations. | **B** — avoids duplicate global setup and uses explanatory routing. |
| Memory review | Users can inspect logs and dreams but may not know whether missing memory is normal. | Add a separate memory onboarding page. | Summarize memory availability on overview and link directly to memory. | **B** — overview makes absence understandable before a user opens memory. |
| Budgets | Budget warnings are present, but budget configuration is separated between global settings and agent configuration. | Centralize all budgets in settings. | Keep global and agent budgets separate, but surface risk on dashboard and overview with direct links. | **B** — respects scope while making recovery fast. |
| Account, timezone, provider settings | Settings are a mixed maintenance page and users may not know which setting affects agent behavior. | Create a setup wizard. | Add contextual entry points from dashboard and overview when settings are relevant. | **B** — users reach settings from the problem they are solving. |
| Waitlist/admin management | Admin-only waitlist tools are hidden in settings, which is acceptable but discoverability depends on role. | Promote waitlist to global navigation for admins. | Leave it role-gated in settings to avoid distracting non-admin users. | **B** — keeps primary operator flows focused. |
| Error and empty recovery | Empty states explain the absence but rarely offer secondary actions if the primary action cannot be completed. | Add support links to every empty state. | Add targeted secondary recovery links only where they unblock the current task. | **B** — avoids noisy support links and improves relevant recovery. |

## Implemented UX changes

1. Dashboard now has a contextual setup checklist for first-run users and a ranked next-actions panel for active work.
2. Dashboard quick actions now explain why each destination matters instead of being a flat list of links.
3. Agent registry now supports operational status filters and a one-click reset when search/filter combinations hide everything.
4. Agent overview now recommends the best next step based on paused state, missing tools, missing budget, missing memory, and recent failures.
5. Agent overview panels now retain the factual summaries but are preceded by a task-oriented recommendation so users do not have to synthesize state manually.
