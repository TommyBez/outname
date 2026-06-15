# Design — OUTNA.ME

A locked design system for this app, established by the modern-minimal redesign
(landing first). Every page redesign reads this file before emitting code. Do not
regenerate per page — extend or amend this file when the system needs to grow.

> **Palette is the hard constraint:** the colours below are unchanged from
> `apps/web/app/globals.css`. The redesign keeps them and changes only radius,
> type, and structure. Designed in Pencil (`pencil-new.pen`).

/ * Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app · nav: N5 · footer: Ft1 * /

## Genre
modern-minimal (Linear / Vercel / dev-tool school). Confident Geist display,
generous whitespace, product surfaces front-and-centre, red as a signal only.

## Macrostructure family
- **Marketing pages:** Workbench (product-tour). Hero = H2 split diptych
  (headline+lede left, live product surface right). Marquee Hero is the
  acceptable alternate for sub-product launches.
- **App pages:** Workbench / dashboard shells. MUST NOT use enrichment — the UI
  carries the page.
- **Content pages (blog, legal):** Long Document — typography only.

## Theme (palette PRESERVED — identical to globals.css)
- `--color-paper`    `#ffffff`  — base surface
- `--color-ink`      `#000000`  — primary text, primary CTA fill
- `--color-surface`  `#f2f2f2`  — muted surface (cards-on-page, chips, sidebars)
- `--color-muted`    `#4a4a4a`  — secondary text
- `--color-faint`    `#9a9a9a`  — tertiary / placeholder / mono captions
- `--color-rule`     `#e5e5e5`  — hairline border (derived neutral, same ramp; **new**)
- `--color-accent`   `#ff3000`  — Swiss red. SIGNAL ONLY, ≤ 5% of any viewport
- `--color-accent-ink` `#000000` — text/icon on accent
- `--color-focus`    `#ff3000`  — focus ring (instant, never animated)

On the single dark panel (heartbeat night-log), paper translucencies are used as
overlay modifiers: `#FFFFFF26` (rules), `#FFFFFF99`/`#FFFFFF80` (muted), `#FFFFFFD9` (body).

## Typography (Inter → Geist — retires the Inter-everywhere tell)
- **Display:** Geist, weight 600, tracking −0.02em to −0.035em, roman (never italic)
- **Body:** Geist, weight 400
- **Mono / outlier:** Geist Mono, weight 400–500 — the *data register*: agent logs,
  tool names, counts, labels, timestamps, code-like values. Already in the project.
- Type scale anchor: hero `clamp(2.75rem, 4vw + 1rem, 4.5rem)`; section heads ≈ 42px;
  body 16–19px; mono labels 10–13px.
- All-caps reserved for short mono kickers/labels only, never body.

## Spacing
4-point named scale (`--space-*`). Pages use named tokens, never raw values.
Section vertical rhythm is varied deliberately (hero ~120px top, mid-sections
56–72px) — never identical padding on every section.

## Radii (brutalist `0` → small, technical)
- `--radius-card` `12px` · `--radius-control` `8px` · `--radius-pill` `9999px`
- This is the one structural break from the old Swiss-International system. Palette
  unchanged; the sharp `0px` corners soften to a refined, engineered radius.

## Motion
- Easings: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`.
- Reveal pattern: **off** — the page is composed, not animated in. At most one
  orchestrated entrance on first load.
- Reduced-motion fallback: opacity-only, ≤ 150ms.

## Microinteractions stance
- Silent success (no celebratory toasts).
- Hover delay 800ms · focus delay 0ms.
- Focus ring `--color-focus`, appears instantly, never transitioned.
- One signal per element on hover (colour shift OR 1px translate — never both).

## CTA voice
- **Primary:** `--color-ink` fill, `--color-paper` label, `--radius-control`,
  label + `arrow-right` (lucide). Copy: "Join the waitlist".
- **Secondary:** transparent fill, 1px `--color-ink` border, ink label,
  `--radius-control`. Copy: "Login".
- Red is **never** a CTA fill — it stays a signal.

## Iconography
- Lucide, single library, throughout. No emoji as icons.

## Per-page allowances
- Marketing pages MAY use product-surface "enrichment" (the live agent panel, the
  workspace capture, the night-log) — these are real product UI, not decoration.
- App pages MUST NOT use enrichment.
- Content pages: typography only.

## What pages MUST share
- The wordmark: red `#ff3000` square (11px, 2px radius) + `OUTNA.ME` in Geist 700.
- The accent colour and its placement (≤ 5% per viewport, signal only).
- Geist display+body, Geist Mono data register.
- The CTA voice (ink-fill primary + outlined secondary, radius 8).
- The mono register for agent logs, tool names, counts, and timestamps.

## What pages MAY differ on
- Macrostructure within the page-type family (a marketing route can be Workbench
  on one page, Marquee Hero on another — same type, colour, CTA voice).
- Hero archetype within the marketing family's allowance.

## Landing section order (reference build)
Nav (N5 floating pill) → Hero (H2 split, live agent panel) → Capability strip
(hairline spec band) → Chat showcase (full workspace, scenario tabs) → Composable
workbench (agent shell + 4 named slots) → Heartbeat night-log + final CTA →
Footer (Ft1 mast-headed). Copy and information architecture preserved from the
existing `LandingHomePage`.

## Exports

### tokens.css
```css
:root {
  --color-paper:      #ffffff;
  --color-ink:        #000000;
  --color-surface:    #f2f2f2;
  --color-muted:      #4a4a4a;
  --color-faint:      #9a9a9a;
  --color-rule:       #e5e5e5;
  --color-accent:     #ff3000;
  --color-accent-ink: #000000;
  --color-focus:      #ff3000;

  --font-display: "Geist", system-ui, sans-serif;
  --font-body:    "Geist", system-ui, sans-serif;
  --font-mono:    "Geist Mono", ui-monospace, monospace;

  --space-2xs: 0.5rem; --space-xs: 0.75rem; --space-sm: 1rem;
  --space-md: 1.5rem;  --space-lg: 2rem;    --space-xl: 3rem;
  --space-2xl: 4.5rem; --space-3xl: 7rem;

  --text-sm: 0.875rem; --text-base: 1rem; --text-md: 1.1875rem;
  --text-lg: 1.5rem;   --text-xl: 2.625rem;
  --text-display: clamp(2.75rem, 4vw + 1rem, 4.5rem);

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-short: 220ms;

  --radius-card: 12px; --radius-control: 8px; --radius-pill: 9999px;
}
```

### shadcn/ui CSS variables (maps onto existing globals.css — palette unchanged)
```css
:root {
  --background: #ffffff;          /* paper */
  --foreground: #000000;          /* ink */
  --primary: #000000;             /* ink CTA */
  --primary-foreground: #ffffff;
  --secondary: #f2f2f2;           /* surface */
  --muted: #f2f2f2;
  --muted-foreground: #4a4a4a;
  --accent: #ff3000;              /* signal red */
  --accent-foreground: #000000;
  --border: #e5e5e5;              /* hairline (was #000000) */
  --input: #e5e5e5;
  --ring: #ff3000;
  --radius: 0.5rem;               /* was 0px */
}
```

### Implementation deltas vs. current code (for the code redesign pass)
- `apps/web/app/layout.tsx`: swap `Inter` → `Geist` (keep `Geist_Mono`).
- `apps/web/app/globals.css`: `--radius: 0px` → `0.5rem`; `--border`/`--input`
  `#000000` → `#e5e5e5`. Palette colours otherwise untouched.
- Marketing components: restructure to the Workbench macrostructure + N5/Ft1 per
  the Pencil build; drop the per-section red eyebrows and the all-caps giant
  display in favour of Geist 600 sentence-case heads.
- Hero: drop the `TextLoop` word-loop (`packages/shared/marketing/components/landing/landing-hero-demo.tsx`) — the kicker is a static label; the capability strip already covers the capability words statically.
- Copy follows `.agents/product-marketing.md` (SaaS-first + claim hygiene): lead with **hosted**; demos use shipped maintainer tools only (Resend/Cal.com/GitHub/Slack — never native Gmail/calendar); channels precise (browser chat + Slack shipped; Discord/Telegram marked roadmap "soon"); no "automatic learning" (memory = readable files); surface provider choice (Vercel AI Gateway/LLM Gateway/OpenRouter) and open-source-as-trust (not self-hosting).
