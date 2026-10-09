---
schema_version: 2.1.0
status: draft
last_updated: 2026-10-10
doc: design
working_product_name: Twofold
repository: Alexandre-Nevero/focuslocal
owns: UI identity and tokens · components · visual states · in-app routes and actions · per-route auth expectation · accessibility · implementation handoff
reference: User-selected warm-cream Twofold dashboard mockup, 2026-10-10
implementation_status: specification only; not a claim that these screens or routes ship
---

# Design — Twofold

> **Design decision:** The warm-cream dashboard image selected by Alexandre on 2026-10-10 is the **visual target** for Twofold. The product remains the offline desktop session review specified in [`prd.md`](prd.md). [ADR-012](adr/ADR-012-meant-loop-on-device.md) adopts MEANT's loop: the start popup, the blocker, the cycle, saved lists, presets, and a day timeline beside the month of rows. It does not adopt MEANT's account, its donut, or its fidelity percentage. Those fight F-012 and BR-006.
>
> **Scope boundary:** The selected image approves visual direction, composition, brand treatment, and the dashboard's information hierarchy as a design exploration. It **does not silently override** the PRD's accepted rules, invent backend data, authorize cloud functionality, or prove that the UI exists. Conflicts are explicitly tracked in §2 and §15.

**Repository name and code status.** The repository is currently `focuslocal`. Its documentation, Electron title, storage location, IPC namespace, and README still use the working name **Ledger**. This file proposes the public-facing name **Twofold**. A rename of identifiers, directories, paths, data files, native-host IDs, or packaging metadata is a separate migration. Do not change persistent paths merely to match a mockup.

**Source-of-truth order.** Follow [`index.md`](index.md): accepted ADR for a concern, then its owning document. [`prd.md`](prd.md) owns product behavior and screens; [`system-design.md`](system-design.md) owns technical contracts; [`data-model.md`](data-model.md) owns stored fields. This design file owns the visual presentation of those facts. Where the reference image conflicts with those owners, the issue is **OPEN**, not approved by implication.

## 1. The approved visual direction

### 1.1 What to reproduce

The chosen reference is a light, warm, paper-like **desktop dashboard** at approximately **1672 × 941 image pixels**. That is a mockup canvas, **not** the application's current viewport (the existing Electron main window opens at **960 × 700**).

**The image's major zones, in order:**

1. A cream app frame with generous rounded outside corners, a slim navigation header, an abstract contour-ring logo, and the horizontally split lowercase **twofold** wordmark.
2. Top navigation as shown: **Dashboard · Ledger · Patterns · Field Notes**, with Dashboard active. A small search glyph, **Network blocked** status pill, and circular terminal control sit at right.
3. Large serif month title, a short supporting line, then period navigation with previous/next arrows, month selector, **Day / Week / Month**, and **Today**.
4. A wide **Monthly breakdown** panel with a compact column plot and date hover card.
5. A full-width **Your intention, laid over the session** panel: continuous thin intention line with registration marks, and a second segmented band for observed window states. Compact legend below.
6. A wide **Daily Ledger** preview: today's temporal track, clock ticks, and a session row.
7. A three-column lower band: **Recent sessions**, **Detours**, and the reference's circular **Attention breakdown** card.

Preserve the **visual grammar**: cream-on-cream panels, slight inset card shading, curved corners, serif editorial headings, compact technical metadata, near-black text, restrained burnt-orange accents, and ample horizontal space. Keep the **monthly → session overlay → daily record → details** hierarchy. Do not replace it with an unrelated sidebar, KPI grid, giant hero illustration, mascot, or a generic analytics template.

### 1.2 What is *not* authoritative in the picture

The image is not a tested specification of formulas, data, navigation, or privacy claims. It contains example sessions and visual choices that need product resolution:

- The top monthly graph uses an hours axis and a focus-colored bar. Its position and chart design are selected; a productivity/attention metric is **not** approved by the PRD.
- The last card is a proportional ring labeled **Attention breakdown**, although [`prd.md` BR-006](prd.md) excludes rates and scores. The card's **place in the grid** is selected. Live percentage/progress semantics are **blocked pending a product decision**.
- The screenshot labels session duration **Focus** and uses color to imply its meaning. Window time is not the same thing as intention-serving time.
- **Patterns**, **Field Notes**, the search glyph, and the **A** avatar-shaped control have no matching shipped route, search API, notes feature, or account requirement. Their shapes are references, not permission to add those features.
- The monthly plot depicts multiple active days while one part of the example claims a small month total. Its sample numbers are internally inconsistent. Implement every figure from one source of session data, never from the drawing.

## 2. Product rules that control the design

| Rule | Design consequence | Source |
|---|---|---|
| Awareness beats accountability. | Lead with intention against the observed windows; the finish answer is secondary, after the record. No praise or scolding. | [ADR-008](adr/ADR-008-awareness-over-accountability.md), PRD BR-002/BR-007 |
| A running session stays quiet. | Running, mini window, extension status, and widgets show **intention + clock**, without live labels, warning colors, predictions, or a progress gauge. | [ADR-001](adr/ADR-001-silent-review.md), PRD BR-001 |
| Never invent window observations. | Show **Away**, **Unclear**, and **Not recorded** distinctly. Empty data is blank, not a complete bar. | PRD US-002/US-003/US-010 |
| No rates, scores, streaks, or hours headline. | Avoid focus score, productivity rate, finish %, comparisons, arrows implying improvement, and proportional rings treated as a success metric. | PRD F-013/BR-006/US-007 |
| Label source is inspectable. | Every Review visit exposes whether a rule, memory, user, or on-device model supplied the current label. | PRD US-003/US-004/US-005; [ADR-002](adr/ADR-002-harness-order.md) |
| A tap does not instantly train memory. | Only show a remembered source when it actually comes from memory after repeated user taps. | PRD BR-004 |
| No account, sync, or cloud model. | Do not add login UI, sign-out, cloud pairing, online account profile, or backend-only charts. | PRD F-012; [system design](system-design.md) |
| Local claims must be demonstrable. | Use accurate **Network blocked** status and model/source facts. Explain that the app does not itself measure packets. | PRD US-008; system design §9 No network |
| Start works with no intention and with no model ready. | Empty intention is a supported state; no blocking validation and no model-loading gate. | PRD US-001/US-003 |
| The current cycle is Windows-first. | Prioritize Windows tray, native popover, 960×700 main window, keyboard, scaling, and raster tray sizes. | [ADR-007](adr/ADR-007-windows-first.md), [`electron/windows.ts`](../electron/windows.ts) |

**Hard interpretation:** A visual element may be retained as a *shape* while its original label or data encoding changes. A new measurable feature may not be presented as existing without a PRD + system-design update. The selected screenshot remains the aesthetic reference in both cases.

## 3. Brand system

### 3.1 Identity and positioning

- **Display name:** `twofold` in the wordmark, **Twofold** in UI prose, window titles, tooltips, and screen-reader names.
- **Product:** a private, local desktop review of a stated intention and the windows actually used.
- **Narrative contrast:** **your words** and **what the machine observed**. Neither layer is a grade.
- **Antagonist:** imperfect memory of switching and duration, and a bare log that cannot know the reason for a window. Never imply that a visit to YouTube or Slack is inherently wrong without reference to the user's intention.
- **Claim boundary:** Show what was recorded. Do not promise habit change, recovered work hours, better output, or verified productivity improvements.
- **Default headline family:** “What you meant, and what the windows show.” This is an optional marketing/empty-state line; it must not replace functional screen labels.
- **Privacy voice:** plain and verifiable. “Network blocked” is preferable to sweeping claims such as “nothing can ever leave your computer.”

### 3.2 Logo: contour mark

The screenshot selects an **abstract circular survey mark** beside the wordmark. For production use the previously specified, readable **two-contour geometry**:

- On a 64 × 64 master, center both contours at `(32, 32)`.
- Outer contour: radius **26**, stroke **6**, complete 360° loop, no central dot. Draw in the brand's warm accent (`--tf-accent` Coral, or `--tf-accent-strong` Tan where more weight is needed) on light surfaces.
- Inner contour: radius **15**, stroke **6**, **unequal broken arcs** rather than equal spokes. Suggested arcs clockwise from twelve o'clock: 20°–170°, 185°–275°, and 290°–365°. Stroke dark umber on light surfaces.
- The outer/inner pair expresses **one stated intention and a fragmented observed trace**. It must not look like a 75%-complete progress ring, a recording indicator, target, eye, or loading spinner.
- Render the icon as an SVG asset in the app interface. Draw a **separate hand-hinted raster tray icon** at 16, 20, 24, and 32 px. Electron's current tray loader accepts a raster image; do not rely on an SVG tray icon.
- In small contexts use the icon alone. No number inside the ring, no animated rotation, and no runtime connection to the data.

The reference screenshot's small upper-left icon is the appearance target. The exact final traced vector remains an **asset to produce and test**, not an asset embedded in this document.

### 3.3 Split wordmark

- Spell **twofold**, lowercase, bold grotesk, with **one clean horizontal cut** through every letter at the same height. Do not use a strike-through line or double lettering shifted apart.
- Top half: dark **umber** (`--tf-ink`, Dark Brown). Bottom half: **Dusty Blue** (`--tf-brand-lower` `#8CA8C7`), the lower-brand hue from the Mascot board. This revises the earlier teal/petrol lower half; the Mascot board is the newer reference.
- Gap is transparent, narrow enough to remain one readable word. Draw vector outlines once finalized instead of relying on inconsistent font clipping between platforms.
- The two halves are always part of the brand; they do **not** mean a label changed or a session was successful.
- For a tiny header, use one-color text or mark-only if the cut becomes illegible. Never shrink the split into a shimmering one-pixel artifact.

### 3.4 Palette: measured reference vs canonical tokens

The palette below is taken from the Mascot character asset board. Those nine named swatches are the canonical source colors. The `--tf-*` tokens map each UI role onto one of them. Rendered swatches use lighting and gradients, so verify every token against WCAG contrast on actual Electron surfaces before marking the palette final.

**Source swatches (Mascot board):**

| Name | Hex |
|---|---|
| Cream | `#F7EFE2` |
| Tan | `#D8A464` |
| Ochre | `#E4A33B` |
| Dark Brown | `#3B2D22` |
| Sage | `#9CA98A` |
| Dusty Blue | `#8CA8C7` |
| Coral | `#E89B7D` |
| Lavender | `#C9C3E6` |
| Butter | `#F5D884` |

**Role tokens:**

| Token | Value | Source swatch | Function | Rule |
|---|---|---|---|---|
| `--tf-canvas` | `#F2E8D7` | Cream (shaded) | Slightly darker sand outside the app frame | Only the surrounding desktop-stage area, if one is drawn |
| `--tf-surface` | `#F7EFE2` | Cream | Primary cream frame and UI background | Default screen ground |
| `--tf-panel` | `#FBF4EA` | Cream (lifted) | Inner card faces | Avoid white cards that appear disconnected |
| `--tf-panel-inset` | `#EFE2CE` | Cream/Tan mix | Soft inset timeline tracks, inactive pills | Not a separate semantic status |
| `--tf-ink` | `#3B2D22` | Dark Brown | Titles, body, mono labels, icons | Primary readable ink |
| `--tf-ink-muted` | `#6F5744` | Dark Brown (lifted) | Secondary description and metadata | Verify ≥4.5:1 on each actual surface |
| `--tf-accent` | `#E89B7D` | Coral | Decorative mark, intended-state edge, selected controls | **Not** small body text; too light on cream for AA |
| `--tf-accent-strong` | `#D8A464` | Tan | Stronger warm fill where Coral is too pale | Decorative/fills; verify on cream |
| `--tf-accent-text` | `#8A4A0B` | Ochre (darkened) | Accessible dark variant of the warm accent | For accent-colored text; verify ≥4.5:1 on `#F7EFE2` |
| `--tf-highlight` | `#E4A33B` | Ochre | Hover/selected emphasis, period-nav active | Decorative emphasis, not a success signal |
| `--tf-brand-lower` | `#8CA8C7` | Dusty Blue | Wordmark lower half | Brand-only; verify before using as small text on cream |
| `--tf-brand-lower-text` | `#4F6E8E` | Dusty Blue (darkened) | Optional accessible lower-brand text, if ever necessary | Verify ≥4.5:1 on cream |
| `--tf-rule` | `#DDC9B1` | Tan (desaturated) | Gentle panel borders and separators | Decorative; interactive controls need stronger boundaries |
| `--tf-control-edge` | `#6F5744` | Dark Brown (lifted) | Input, keyboard focus, and actionable control edge | Visible on cream |
| `--tf-track` | `#EADCC8` | Cream/Tan mix | Neutral clock/timeline track | Does not imply away, drift, or uncertainty |
| `--tf-support-sage` | `#9CA98A` | Sage | Optional neutral categorical accent | Never the sole carrier of a semantic state |
| `--tf-support-lavender` | `#C9C3E6` | Lavender | Optional neutral categorical accent | Never the sole carrier of a semantic state |
| `--tf-support-butter` | `#F5D884` | Butter | Optional neutral categorical accent | Never the sole carrier of a semantic state |
| `--tf-unknown` | **pattern** | — | Unclear window | Never a color-only state |
| `--tf-unrecorded` | **gap** | — | No captured observation | Never silently treated as zero |

**Use one principal warm hue.** Coral/Tan describe **the human-entered intention and active UI selection**, not goodness or failure. Dusty Blue is reserved for the twofold wordmark, not the charts. Sage, Lavender, and Butter are optional neutral categorical accents only; the observed data still needs **neutral ink + patterns + labels**. Icons resembling YouTube/Slack/Reddit can retain recognizable pictograms only if the surrounding row text remains sufficient without color.

**Contrast caution.** Coral `#E89B7D`, Tan `#D8A464`, Ochre `#E4A33B`, and Butter `#F5D884` are all light warm hues that fail AA as small text on cream. Use `--tf-accent-text` (or `--tf-ink`) for any text that must read against the cream ground; reserve the light swatches for fills, edges, and decoration.

**Color collision warning.** Coral and Ochre are close warm neighbors. Production must reserve the thin warm **overprint line** for “your intention” and give the observed segments below it separately identifiable **pattern fills**, not just a second warm hue. User testing must confirm people can explain both layers correctly.

**Dark appearance:** not selected in this screenshot. Support a system-following theme later without inverting photographic colors mechanically. Do not declare an unreviewed dark palette approved. Windows high-contrast/forced-colors mode takes precedence over all custom colors.

### 3.5 Typography

Reuse the established MEANT font pairing, **bundled locally** for the offline Electron renderer. The MEANT source confirms `Fraunces`, `Public Sans`, and `Sometype Mono` in `meant/app/layout.tsx`, with tracking and role tokens in `meant/design/tokens.css`. The exact font sizes below are a build proposal using the selected screenshot's hierarchy.

| Role | Font / weight | Desktop reference scale | Meaning |
|---|---|---|---|
| Month/page H1 | Fraunces 600 | 50–58 px wide screen; 30–36 px at 960 width | Human, editorial, authored |
| Card title | Fraunces 600 | 23–27 px wide; 19–22 px compact | Human section orientation |
| Intention headline | Fraunces 600 | 22–28 px, wrap at 2–3 lines | The user's own words |
| Body / controls | Public Sans 400/500/600 | 14–16 px | Functional navigation and reading |
| Navigation | Public Sans 500/600 | 14–16 px wide; 13–14 px compact | Clean and quiet |
| Figures and clock | Sometype Mono 500/600 | 12–16 px (32 px for large review switch count) | Recorded/measured facts |
| Card eyebrows / axes | Sometype Mono 500/600 | 11–12 px (12 px preferred) | Technical survey annotation |
| Split wordmark | Public Sans Black / outlined vector | ~43 px apparent height at reference width; smaller in actual app | Wordmark, not a normal text heading |

Avoid low-contrast tiny grey text. Set `font-variant-numeric: tabular-nums` on numbers and clock labels; don't rely on letter-spacing to align numerical columns. Fonts **must be stored in package assets** (WOFF2, with license obligations checked). The shipped renderer blocks web font requests. **The current repository has no font assets or completed design CSS**, so those are implementation work.

### 3.6 Material, space and shape

- Screenshot feels like **ink on warm paper**, not glossy glassmorphism. Use restrained grain outside reading regions. Grain, if included, is a local bitmap/CSS texture with negligible contrast over text.
- Main frame: generously rounded corners (about 24–28 px reference appearance). App frame on actual Electron should fill the window; do not add an unnecessary mock-browser border.
- Cards: radius **18–20 px**, 1 px sand border, very soft warm inset/outer shadows. Recessed tracks and tabs appear to be cut into the cream material.
- Pills/capsules: radius **999 px**. Session highlights and small row pills are warmer panels, not fully saturated buttons.
- Spacing base: 4 px; regular gaps 8/12/16/24/32; wide content margins 24–32 at 960 px and 48–56 at 1440+.
- Motion: no entrance choreography or counting animation for results. A short press/focus transition is acceptable; obey `prefers-reduced-motion`.
- No gamified badge, victory confetti, flame, streak calendar, or red/green verdict legend. The dashboard and the review do not contain a character. The companion is a separate always-on-top window, specified in [ADR-011](adr/ADR-011-coach-companion-and-system-one.md), and it is not a verdict decoration.

## 4. Screen model and navigation

### 4.1 Present implementation vs selected design

The **current** renderer (`src/App.tsx`) contains route headings only. `electron/windows.ts` allows `idle`, `declare`, `permissions`, `running`, `review/:id`, `history`, `privacy`, and `mini`. The route type in `src/shared/types.ts` matches this set. `window.ledger` exposes `session`, `review`, `history.list`, `privacy`, `permissions`, `widgets`, and `windows` operations. **There is no `dashboard`, `day`, `patterns`, `notes`, or search API.**

| Visual surface | Screen purpose | Route status / wiring | Auth |
|---|---|---|---|
| **Dashboard** | Chosen month overview plus selected-day peek, overlay, session records | **PROPOSED** `app://dashboard`; existing `app://history` can initially host the layout as a non-breaking replacement. Adding route requires Electron/TypeScript/renderer changes. | Local, no account |
| **Ledger** | Focused daily time track and session list; selecting session opens Review | **PROPOSED** `app://day/YYYY-MM-DD` or view mode inside existing `app://history`. Not currently present. | Local, no account |
| **Patterns** | View factual repetition in past session rows | **DEFERRED** new screen: PRD US-007 only permits visible repetition and no interpretation. Do not wire a speculative chart or recommendation engine. | Local, no account |
| **Field Notes** | Potential longer descriptive session record | **DEFERRED / UNDEFINED** in PRD. Do not invent a notes database. The coach is F-011, not this screen. | Local, no account |
| **Search glyph** | Would search local sessions | **DEFERRED** (no search story/API). Hide or visibly disable until defined; never a dead clickable control. | Local, no account |
| **Right circular control** | Occupies avatar position in mockup | **PROPOSED** local Settings/Privacy button with accessible label; **not** a user account/avatar or sign-out. | Local, no account |
| Permissions | Explain OS capture prompt | Existing `app://permissions` route | Local, no account |
| Idle / Declare / Running | Session setup and silent run | Existing `app://idle`, `app://declare`, `app://running` | Local, no account |
| Review | Primary intention-versus-visit experience | Existing `app://review/{sessionId}` | Local, no account |
| History | Past-session access; canonical PRD `US-007` | Existing `app://history`, may be dashboard backing screen | Local, no account |
| Privacy | Local model/source/file facts and delete actions | Existing `app://privacy` | Local, no account |
| Mini | Intention and clock only | Existing `app://mini` | Local, no account |
| Companion | The coach's character. Drag, hover, tap opens the popup (US-012) | **SPECIFIED, not built.** New window, not a route inside the main window. See [ADR-011](adr/ADR-011-coach-companion-and-system-one.md). | Local, no account |
| Coach | One ended session, from computed figures (US-011). A suggestion needs a button. | **SPECIFIED, not built.** Opens from the companion when idle, and from the review. | Local, no account |
| Declare popup | Intention, cycle, where it happens, what to block, Start (US-001, US-014, US-016) | Existing `app://declare`. The fields in [ADR-012](adr/ADR-012-meant-loop-on-device.md) are specified, not all built. | Local, no account |
| Sites | Saved work list and block list (US-015) | **SPECIFIED, not built.** | Local, no account |
| Block window | Intention and "That's still true." No duration. | **SPECIFIED, not built.** | Local, no account |
| Day | One day's sessions on the review trace (US-007) | **SPECIFIED, not built.** Not a score dashboard. | Local, no account |
| macOS desktop widget | Read-only intention and clock | PRD planned, not a current renderer route | Local, no account |
| Browser extension popup | Read-only intention and clock | PRD planned, not a current renderer route | Local, no account |

**Navigation rule:** The selected screenshot's four labels are the **visual target**, but an initial compliant release must only expose working destinations. Use `Dashboard · Ledger` when each has a real destination; show `Patterns` and `Field Notes` only as clearly disabled/coming-later concepts in a prototype, or omit them from the real navigation. Keep spacing so adding them later does not require changing the identity system. Keep access to `Privacy` through the status pill/right control even if `Settings` is not in the primary nav.

**Naming conflict:** The earlier Survey handoff proposed `Today · History · Settings` and disallowed the word “ledger.” The **newer chosen screenshot explicitly selects** `Dashboard · Ledger · Patterns · Field Notes`. For this new design, “Ledger” is only a name for a chronological daily record, not an account book. Do not introduce debit/credit, billing, accounting metaphors, or “time spent well” language. Product owner should ratify this UI-name exception alongside the route decision.

### 4.2 Existing product flow is retained

`Permissions (if needed) → Idle → Declare → Running → Review → History/Dashboard`.

The Dashboard is a destination **after** sessions. It cannot replace the Review, and its charts cannot delay opening the Review when a session ends. First use without records should still lead to starting a session, not a fake populated dashboard.

## 5. Dashboard: the selected reference screen

**Design intent:** read the month, then see a specific session against its intention, then find the day's record and drill into details. This is an overview screen, not an evaluation of how well someone worked.

### 5.1 Composition at reference width

Keep this order and card relationships:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [contours] twofold  [Dashboard]  Ledger  Patterns  Field Notes      ◯  Network blocked ◯ │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ October 2026                    [‹] [October 2026] [›] [Day Week Month] [Today]         │
│ Short month description                                                                   │
│ ┌──────────────────────── MONTHLY BREAKDOWN ───────────────────────────────────────────┐ │
│ │ Date-based columns + selected-day hover details                                   │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────── YOUR INTENTION, LAID OVER THE SESSION ───────────────────────────────────┐ │
│ │ thin continuous overprint with circular registration ends                         │ │
│ │ segmented observed-state strip  | solid | hatch | dotted | gap |                   │ │
│ │ legend: intention · served · drifted · unclear · away · not recorded                │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────── DAILY LEDGER / SELECTED DAY ───────────────────────────────┐ │
│ │ time-of-day ruler        [one or more session spans]                                │ │
│ │ session rows with intention, clock range, label/count, open-review chevron          │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌───────── RECENT SESSIONS ─────┐ ┌──────── DETOURS ────────┐ ┌── WINDOW LABELS ──────┐ │
│ │ session links / outcomes     │ │ examples, lengths      │ │ absolute observations │ │
│ └──────────────────────────────┘ └──────────────────────────┘ └─────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

At widths **1440 px and above**, use a centered content max-width around 1500–1560 px and the same visual proportions as the image. Use a wide 1-column stack for the first three cards, then a **three-column lower section** with approximately 1:0.82:1 width distribution. At the real **960 px** viewport, retain the zone order but scroll vertically; do not shrink text and charts to fit the whole image without scrolling.

### 5.2 Header and period controls

- Brand at left: 42–48 px contour mark on the large reference; responsive smaller in actual app, with wordmark to its right.
- Navigation uses quiet 14–16 px Public Sans, with an **inset cream capsule** behind the selected item. Use text weight as well as shape for selection.
- Network state at right is readable without color. A dot can decorate the text but must not be the only status cue.
- The circular `A` in the screenshot is **not** authorization to invent identity or account management. Replace with a compact local settings/privacy button while keeping its size/position; label the action for screen readers.
- The month title is the primary heading (Fraunces). Under it, a short factual date caption is safe. The screenshot's line “A quieter, more intentional month.” is **marketing-style placeholder copy**, not an inference from logs. Use it only if editorially approved and never generate it from data.
- `‹` and `›` change the selected period according to mode. The month control selects month/year. `Day | Week | Month` updates chart aggregation. `Today` returns to the present date and relevant period. Keep selected state accessible with `aria-pressed` or tab selection semantics.
- No disabled-looking controls that accidentally respond. All interactive month/day actions must update all dependent cards, not only the heading.

### 5.3 Monthly breakdown card

**Approved visual form:** wide low-relief plot card, thin uppercase mono heading, light columns rising from a common zero baseline, subtle horizontal guides, compact labeled dates, and a cream hover/focus popover near a selected column.

**Default compliant mapping while PRD BR-006 remains unchanged:** plot **number of recorded sessions per day** (a factual count, not hours or success). Example tooltip fields: `Fri, Oct 9`, `1 session`, and only if computable, `Recorded windows: …` and `Away: …` in minutes. Use neutral bars; accent only the selected/hovered day (navigation state, not performance). Set axis to **session count**, not `0h–8h`. Header right may say `OCTOBER 2026 · {n} SESSIONS` when data exists. Empty days show zero sessions without pretending unrecorded time is measured.

**Alternate screenshot-exact metric (BLOCKED):** hours-axis attended-time bars, 23m total, focus-colored bars and their proportional encoding. These require explicit product sign-off if they become a time/focus headline or rate. An approved design screenshot alone cannot change F-013/BR-006. Never claim this alternate is already in scope.

**Period semantics:** Day = one chosen calendar day (session count/visits scoped to it); Week = seven local calendar days; Month = the chosen local calendar month. Date boundaries use the device's local timezone consistently and actual stored timestamps. All panels that depend on date must use the same range. If a duration crosses midnight, define the allocation policy in the product/data owner before building graphs that split it. Do not silently count the same session twice.

### 5.4 Intention-over-session overlay: signature component

This card is the brand's most distinctive UI element and remains on the Dashboard **as selected**, even though the Review also needs the detailed version.

**Two distinct layers:**

1. **Human overprint**: a single 2–3 px warm Coral (`--tf-accent`) rule across the entire selected session width, round registration ends. Optionally a transparent washed band beneath the rule. It never shortens or changes color based on success.
2. **Observed trace**: a separate 24–30 px segmented bar beneath it, using the actual chronological visit intervals. Segment width follows **elapsed observed wall time**, not model confidence, and includes recorded away spans or explicit gaps.

**Required legend and accessible label:**

| State | Visual treatment | Meaning / label source |
|---|---|---|
| Your intention | Continuous accented thin line + two registration marks | The declared sentence spans the session. This line is **not a verdict**. |
| Served the intention (`serves`) | Solid **ink** segment | Label is `serves` after the display gate; per-visit source shown in Review. |
| Drifted (`drifts`) | 45° diagonal ink hatch, ≥5 px repeat | Label is `drifts`; this means “not this intention,” not “bad behavior.” |
| Unclear (`unclear`) | Empty/outlined or dotted texture with `?` if room permits | User may clarify; never silently assign to Served. |
| Labelling… | Outline without final fill | Verdict pending; UI must update from `verdict:updated`. |
| Away (`kind='away'`) | Dashed baseline / visibly empty track | OS-idle/lock observation, **not** a window classification. |
| Not recorded (`unrecordedMs` or gaps) | **Actual blank gap** and text in tooltip/list | The app cannot say what was open. Do not convert to Away or Unclear. |

Use **text plus pattern**, not hue alone. The reference's warm-filled status segments are a visual starting point, but coloring Served/Drifted like the human intention would merge the two layers. The warm overprint line is the only continuous Coral element in this component. Each overlay shows exactly **one selected session**; do not combine all visits from different sessions into a false continuous story.

**When no session is selected:** show an empty component with the instruction `Select a session to see its windows.` (proposed copy) or an equivalent factual prompt. Do **not** render a decorative example trace as if real. When the selected session has no intention, name that fact and omit the implication that the upper band contains a declared plan. When all visits are unclassified, outline the segments and explain the state.

**Interactions:** choosing a day in the top card can select its most recent ended session **only if** that default is explicitly labeled (avoid unexplained auto-selection). Keyboard selection of each segment must reveal the same data as hover. The session strip has one accessible description and a linked list/table of visits so screen-reader and keyboard users can inspect each interval without dozens of forced tab stops. Tooltips give time, app, title if present, label, and source where available. Gaps have explicit provenance.

### 5.5 Daily Ledger preview

Keep the **wide daily timeline card**, inset rounded track, 04:00–22:00-style clock markings from the reference, followed by session rows with a chevron. But calculate the visible clock range from the selected day's actual time span: a session outside 04:00–22:00 must remain visible. The fixed 04:00–22:00 ruler is only the reference example, not permission to hide night work.

- Title can remain **Daily Ledger · Friday, Oct 9** as a navigation name, subject to the naming exception in §4.1. The actual daily page is a detailed version of this same component.
- Summary at the right must identify **number of ended sessions** and, where derived accurately, counts such as switches or detours. A value must be attributable to a specific period; do not present selected-session metrics as whole-day totals.
- Each session occupies its real start/end interval on the clock axis. Multiple sessions appear as separate tracks or non-overlapping segments. **Do not place session summary labels as if they were evidence of which windows served the intention.** That detail belongs in the overlay and Review.
- Row text: intention (or `No intention given`), local time range, elapsed duration, raw outcome status (`Yes` / `Not yet` / `Unanswered`) as **neutral text**, and a chevron or linked title to Review. Do not use `Focus` as a binary status; capture does not establish cognitive focus.
- `Away`, captured window time and unrecorded gaps remain distinct. Never show a `23m recorded + 3m away` session as a `23m` total wall-clock span.

### 5.6 Lower cards

**Recent sessions.** Preserve the left card placement and cream highlighted row. Its rows link to the actual Review ID. Display stated intention, date/time, and possibly elapsed minutes as a subordinate figure. Do not show invented recent sessions or account-like metrics. Empty: `No sessions yet.` Action leads to Declare/Idle.

**Detours.** Preserve center card placement and short rows (app/site, duration, chevron). A detour is not defined in the current PRD or data model. **Provisional design definition** from the Survey handoff: a contiguous stretch of visits labeled `drifts`, potentially including an intervening `unclear` visit, with no `serves` between. This needs a product-owned rule for (a) whether unclear may be merged, (b) how away and capture gaps break a detour, and (c) whether app/site titles may be combined. Until defined, show the **per-visit drifted rows** directly, with the precise label `Drifted windows` rather than asserting algorithmically constructed detours. The screenshot's `3 found` and three app icons are sample-only, not a fixed count.

**Circular bottom-right card.** Preserve its **size, position, title hierarchy, and quiet circular motif**, but resolve its semantics before implementation:

- **PRD-compliant default:** rename to **Window labels**. Use a **non-data-encoded contour illustration** derived from the logo, next to a factual list of absolute durations/counts by label (`Served`, `Drifted`, `Unclear`, `Away`, `Not recorded`) where derivable from actual rows. Do not vary ring length, arc size, or hue according to performance or proportion. Treat the contours as illustration with `aria-hidden`.
- **Screenshot-exact donut:** `Attention breakdown` with a 23m center and proportional ring segments is **BLOCKED** until the PRD explicitly permits that representation. It is visually a rate/part-of-whole encoding even if `%` is not printed. If accepted later, separately define denominator, labels, gaps, scope (selected session vs whole month), and accessibility before coding.

The above compromise keeps the reference card's visual footprint without quietly violating the product contract. If a strict pixel-match is required, stop at a **static marked mock** for this one card and request a product rule change rather than inventing a runtime statistic.

## 6. Ledger / daily view

**Purpose:** detailed chronological browsing for a selected day. This is a drill-down from the Dashboard's Daily Ledger preview, not a competing definition of sessions.

- Preserve the MEANT daily page's established organization: date heading + arrows, full-width daily timeline, followed by today's sessions. Apply Twofold's cream, typography, inset tracks, logo and patterns.
- The day's clock track is proportional to real time. User can select another date. Clicking a session opens `app://review/{sessionId}`.
- Session rows have clear outcome text, count of switches only when a validated definition exists, and mini overlay strips only when visit data has been loaded. No unbacked “focus” classification or attention percentage.
- Empty day: `No sessions ended on this day.` (proposed). If no session is running, surface `Start a session` to the existing flow. Show ongoing session only as intention and clock, without a live classification (BR-001).
- **Data contract:** `history.list()` yields a summary only. `review.get(id)` returns visit details on a specific ended session. For an overview of many sessions, coordinate a **batched read-only summary IPC** change with the system-design owner rather than doing unbounded N-per-row Review fetches or duplicating the SQLite schema in the renderer.

## 7. Review: primary product experience

The Dashboard looks like the chosen screenshot, but the Review is the app's **first-value moment**. It must not become an afterthought.

**Dedicated window:** currently `app://review/{sessionId}` in a 960 × 700 main window, no large analytics dashboard frame. Keep the warm cream style, contour mark, tiny review header, and source patterns.

### 7.1 Information order

1. **YOU MEANT TO** and the exact intention sentence (or `No intention was written for this session.`).
2. **Window switches** count, only if its counting definition is confirmed. State the recorded scope; unrecorded time is not counted.
3. **Detours** if defined or **drifted windows** with truthful per-visit labels; include uncertainty rather than implying all drifted time is known.
4. **Intention-over-session strip** (same component as Dashboard but here it belongs to the single ended session).
5. **Windows you used**, in chronological rows with app, window title or URL, start time, duration, verdict, and **source** (`your list`, `remembered`, `on-device model`, `you marked it`). Show `Unclear. You decide.` with `Served` and `Drifted` actions. State `Away` and `Not recorded` explicitly.
6. **Did you finish?** `Yes` / `Not yet` with equal button weight; `Skip for now`. On saved answer, use a neutral confirmation and `Change`, nothing evaluative.
7. Privacy footer with model ID/status, model-call count when available, saved local file details, and **Privacy details** action.

**Critical placement:** The finish answer stays below the evidence, never above the visit list or inside the Dashboard ring. Closing Review without answering results in `unanswered`; a reopen does not fabricate Yes/Not yet.

### 7.2 Label and loading rules

- A rule match has source `rule`; a repeated-tap match has source `memory`; a low-confidence model result remains **shown as unclear** after the display gate, even if a raw model label exists. Use `shown` from `ReviewVisit`, not the raw `verdict.label`, for user-facing labeling.
- Show pending judgments as `Labelling…` (review only, never live in Running). Local model missing/error yields honest Unclear and status; it does **not** block session recording.
- Clicking `Served` or `Drifted` on an unclear row calls `review.tap(id, label)`, updates source to user, and refreshes the displayed row and pattern. A second click on a later visit may affect memory only through the actual harness rules.
- No source may be inferred from app logo or color. Tooltip and row text must state source when a verdict exists.
- Do not show `0` switches or `0` detours for completely unrecorded sessions as if this means the user stayed focused. Include the **Not recorded** gap.

## 8. Permissions, Idle, Declare, Running, Mini, Privacy

| Surface | Content | Interaction / constraint |
|---|---|---|
| **Permissions** (`app://permissions`) | Human explanation of which OS permission enables frontmost window/title capture; current state and failure result. | Buttons to open prompt/retry. Denied state must not make up visit data. |
| **Idle tray popover** (`app://idle`, 320×420) | Mark, twofold name, one-line intention field entry, Start, History/Dashboard, Privacy. | No account, ads, coach, or live judgment. Popover layout works near bottom/right taskbar. |
| **Declare** (`app://declare`) | Intention input, work list, distraction list, Start. | Blank intention **may start**. Lists match current `DeclaredTarget` role: `work` or `distraction`. |
| **Running** (`app://running`) | Intention read-only, clock, End session. If capture failed, a factual capture-status message. | **No live verdicts, charts, drift signals, warnings, praise, or motivational quote** (BR-001). Start did not wait for model. |
| **Mini** (`app://mini`, 280×72) | One truncated intention line and elapsed clock with End action where supported. | 280×72 means no paragraph, nav, or graph. Independent of monitor position. |
| **Privacy** (`app://privacy`) | Local model identifier/status, model-source verdict count, eval run/not-run status, local DB path, memory deletion, file deletion. | Confirm destructive actions. State that the UI does **not** independently inspect packet traffic. `Delete failed, file still present` must be explicit. |
| **macOS widget / browser extension popup** | Read-only intention and elapsed clock. | These are planned in the PRD; not evidence that they already ship. Keep BR-001. |

**Privacy copy:** use `Network blocked` where the Electron runtime actually enforces the network block. The current build blocks non-local requests in its packaged renderer but allows the dev server during development. Model download on `npm install` is an internet-dependent setup step. Never claim the entire installation works without any network access. Keep model-call evidence factual.

**Delete copy:** say what is deleted. The app currently stores local data under `%APPDATA%\Ledger\ledger.db` on Windows. Rename/migrate only after the architecture owner defines migration and fallback behavior. Show the actual `dbPath` returned by `privacy.get()` instead of hardcoding any brand path in UI.

## 9. Component inventory and variants

| Component | Inputs / source | Screen(s) | States |
|---|---|---|---|
| `BrandMark` / `SplitWordmark` | Static local assets | Shell, tray, review, popover | light, single-color, high contrast, 16px tray |
| `AppShell` | Local routes + network/runtime state | Dashboard, Ledger, Privacy | wide, compact, nav-selected, deferred-link |
| `PeriodPicker` | Selected day/week/month | Dashboard, Ledger | idle, previous, next, today, keyboard active |
| `InsetPanel` | Title + body | Dashboard, Ledger | normal, empty, loading, failure |
| `MonthlyBreakdown` | Actual ended session counts for period | Dashboard | empty, one day, multi-day, tooltip, keyboard focus |
| `SessionOverlay` | One ended session + ordered review visits + unrecorded gaps | Dashboard, Review, list mini version | served, drifted, unclear, labelling, away, not recorded |
| `DailyTimeline` | Ended session time spans | Dashboard, Ledger | empty, partial day, cross-day, overlap policy needed |
| `SessionRow` | `HistoryRow` + optionally related visits | Dashboard, Ledger, History | answered, unanswered, no intention, pending summary |
| `VisitRow` | `ReviewVisit` (`shown`, `verdict.source`) | Review | served, drifted, unclear, user-corrected, pending, away |
| `DetourList` (provisional) | Visit sequence after algorithm accepted | Dashboard, Review | unavailable definition, none, partial, resolved |
| `WindowLabelsCard` | Absolute labels/durations, static contour illustration | Dashboard | empty, some data, incomplete capture |
| `OutcomePair` | Current session `outcome` | Review | unanswered, yes, not yet, saved, changed |
| `ListEditor` | Declared work/distraction targets | Declare | empty, list, invalid target, saved |
| `StatusPill` | Network/runtime facts | Shell, Review, Privacy | factual, not-scorable; errors textual |
| `PrivacyFacts` | `privacy.get()` | Privacy | loading, loaded, model missing, run not yet made |
| `ConfirmStep` | Chosen destructive action | Privacy | idle, asking, executing, failed, done |
| `Clock` | Started-at and current OS time | Running, mini, extensions | running, ended, unavailable |

**Data ownership:** No new table or IPC endpoint is declared by this component list. If a component lacks data, use its explicit empty/loading/error state and raise an implementation dependency. Do not fabricate a numeric summary to fill the screenshot.

## 10. Rendering rules and derived data

### 10.1 Source of truth by level

- **Local SQLite:** `session`, `visit`, `verdict`, `declared_target`, `memory` and existing model/eval tables; see [`data-model.md`](data-model.md).
- **Existing IPC:** `history.list()` provides id, intention, start/end, outcome; `review.get(sessionId)` provides ordered visits with `kind`, `shown`, `verdict`, and `unrecordedMs`; `privacy.get()` provides machine facts.
- **Renderer:** may format values and draw controls. It **must not** call the model, read local SQLite directly, infer a verdict, or reclassify a raw `label` through a new ad-hoc rule.
- **Potential future aggregated API:** requires explicit update to system design and shared types, with scope/time semantics. Do not use unpublished MEANT API contracts. The two repositories have different data models.

### 10.2 Strict data definitions

- **Session length:** `max(0, ended_at − started_at)` in elapsed time, from the same session row.
- **Recorded window time:** the union/sum of valid recorded attention visit intervals **after deduplicating overlaps**; `kind='attention'` does not mean `serves`. This number is not a productivity score.
- **Away:** intervals explicitly stored as `kind='away'`; away is not an assumed remainder.
- **Not recorded:** the gap that `review.get` reports (and which should equal valid session wall time minus covered time, with non-overlap handled upstream). Never silently classify the gap.
- **Served / Drifted / Unclear duration:** only from attention visits and the **shown** review label, not `verdict.label` bypassing the display gate. Unclassified visits stay Unclear or pending.
- **Outcome:** independent person-provided answer `yes`, `not_yet`, `unanswered`. It is not a verdict source and never changes the prior window labels.
- **Window switches:** **definition awaiting PRD acceptance.** Candidate: count transitions from one identifiable attention window to another, excluding the first window, away intervals, capture gaps, and repeated polls of an unchanged window. The app currently groups visits by active window key, not an explicit persisted `switch` event. Do not put an agreed-looking count in production until the owner confirms boundary rules.
- **Detours:** **definition awaiting PRD acceptance.** Do not pretend that simply counting every `drifts` visit equals a detour if unclear and away segments interrupt it.
- **Month figures:** derive only from ended sessions within the chosen calendar scope, with a documented timezone and cross-midnight policy. Avoid duplicate counts from sessions crossing periods.

**Example-data guard:** label prototypes, screenshot exports, demo fixtures and mockups `EXAMPLE DATA`; remove the tag only when all shown values come from the real local store. The screenshot's October 2026 numbers are **visual samples**, not analytics evidence or schema defaults.

### 10.3 Empty, loading, error and success states

| Pattern | Empty | Loading | Failure | Ready / success |
|---|---|---|---|---|
| Dashboard | `No sessions yet.` and Start a session link | Skeleton card heights and *no* fake bars | Local read error, retry/open Privacy; no synthetic chart | Actual period, chart, overlay if selected, lists |
| Monthly breakdown | One factual blank plot or empty caption; no sample columns | Stable panel footprint | Explain history read failure | One bar per actual day with data, keyboard tooltip |
| Overlay | Select a session or no visits; honest unknowns | Outline/`Labelling…` | Error text + known capture gaps | Patterned segments + continuous intention line |
| Daily timeline | No sessions for date | Neutral track, no guessed session | “Could not load sessions.” | Clock-positioned ended sessions |
| Detour card | No derived detours; show raw labeled rows if needed | No counts until data available | Explain unavailable calculation | Derived entries only after algorithm is approved |
| Review | No intention or visits can occur | `Reading the local file`; pending labels remain outlined | Error; do not auto-mark finish | Rows, sources, correction controls, optional answer |
| Privacy | Facts may state `none configured` | Local spinner/text, not a network loader | Explicit local read/delete failure | Actual path, model status, counts, confirmations |
| Declare | Empty intention allowed; targets may be empty | Start never waits for local model | Permissions error with recovery path | Session starts and Running opens |

Do not collapse `zero`, `unknown`, `not captured`, `not yet judged`, and `no session` into the same empty visual.

## 11. Interactions and accessibility

**Target:** WCAG 2.2 AA and Windows keyboard support. This is a target, **not** a claim of certification or completed testing.

- **Keyboard:** every interactive card link, selector, date picker, session row and review correction must be operable by Tab/Enter/Space as appropriate. Chart columns and overlay segments need arrow-key traversal or a separate accessible list. Do not trap focus in the Dashboard.
- **Focus:** visible 2 px focus outline with 2 px offset in `--tf-control-edge`/ink, unobscured by glow/shadow. Interactive boundaries require contrast even if decorative 1 px rules do not.
- **Semantic hierarchy:** one `h1` per view; card titles `h2`. Keep chart headings separate from session list accessible names. `main`, `nav`, `section`, and `footer` landmarks where appropriate.
- **Legends:** no visual status relies only on Coral, Dusty Blue, hatch, opacity, icon, or a circle. Give row text or tooltip plus accessible name. The overlay must have a navigable factual equivalent in a table/list.
- **Charts:** provide text describing the metric's unit and scope. The hover state has a focus equivalent; do not require a mouse.
- **Text:** minimum target 12 px for dense data; most running copy 14–16. Verify contrast for all actual background/text pairs; swatch extraction is not a WCAG test. The light warm swatches — Coral `#E89B7D`, Tan `#D8A464`, Ochre `#E4A33B`, Butter `#F5D884` — and Dusty Blue `#8CA8C7` all fall well below 4.5:1 on cream `#F7EFE2`, so **none is approved for normal-size body text**. Use `--tf-accent-text` or dark ink for copy on cream.
- **Screen readers:** symbol-only search/settings/date arrows have meaningful labels. Announce local model state changes without repeating every model verdict during Running. Focus shifts to the Review heading after an ended session opens. Review saved outcome uses polite feedback, never praise.
- **Reduced motion:** honor OS preference and turn off transitions. No auto-playing decorative ring/score animations.
- **Forced colors:** drop paper texture, preserve a clear Canvas/CanvasText contrast, and keep patterns legible without their colors.
- **Windows scaling:** verify 100%, 125%, 150%, 200% DPI; especially text truncation, tray mark, window resize, and 960×700 scrolling.
- **Privacy:** window titles and URLs are private content. No telemetry, fonts, icons, or analytics fetch from external domains in the packaged renderer.

## 12. Responsive behavior

The reference screen is **not** 960×700. Responsive design must preserve information, not merely scale the 1672px screenshot down.

| Main window inner width | Layout |
|---|---|
| **≥1440** (large conceptual/reference view) | Full visual arrangement: one broad monthly chart, full overlay, broad day panel, three equal-ish bottom cards. |
| **1100–1439** | Same vertical order; bottom cards may split 2 + 1; nav compresses without hidden content. |
| **900–1099** (covers existing 960 main window) | Month plot keeps readable tick density; full-width overlay; daily timeline; bottom cards stack or form 2 + 1 only if each remains legible. Scroll vertically. |
| **640–899** | Period controls wrap to a second line; list rows compact, cards stack; charts can scroll horizontally or aggregate ticks with clear labels. |
| **<640** (popover or future narrow surface) | **Do not display the Dashboard.** Use dedicated Idle/Running/Mini UI. Main window can enforce an appropriate minimum width when implemented. |

Session Review remains a different dedicated layout. The main Dashboard must not be shown inside the 320×420 tray popover.

## 13. Implementation map and migration safety

| Work | Existing path / contract | Required implementation |
|---|---|---|
| Brand assets | `public/tray-icon.png`, `electron/windows.ts` | Add locally bundled contour mark, wordmark, tray PNG/ICO sizes; change tooltip/window title only when rebrand is approved. |
| UI typography/colors | `src/App.tsx`, `src/index.tsx` | Add local font assets and CSS variables, components; no `next/font` or network CSS. |
| Main window and routes | `electron/windows.ts`, `src/shared/types.ts` | Keep existing Review/History/Privacy routes working. New `dashboard` / `day` route IDs require edits in regex, `Route` union, renderer switch and navigation. |
| Navigation and shell | Renderer placeholder | Implement selected top nav, active pill, privacy control, date bar, and screen-size adaptations. |
| Session details | `window.ledger.review.get(id)` | Drive overlay/visit list using `shown` and source. Respect capture gaps. |
| Overview data | `window.ledger.history.list()` | Enough for basic session/date count and list; not enough for many visit-level aggregates without fetching reviews. Add bounded batch summary API only after system owner accepts a contract. |
| Detours/switches | `visit`, `verdict`, capture loop | Specify algorithms and tests before declaring metrics live. |
| Data persistence | `electron/paths.ts`, `electron/store/db.ts`, `docs/data-model.md` | **Do not rename** `%APPDATA%\Ledger\ledger.db` without a tested migration. Branding must not delete or orphan past sessions. |
| Running safety | `electron/index.ts`, `electron/windows.ts` | Preserve current local-only networking and silent Running UI. No added background calls for visual polish. |
| Privacy / deletion | `window.ledger.privacy.*` | Show actual local values and implement second-step confirm. No new account/remote deletion story. |
| Documentation name | README, PRD, ADRs, packaging, source comments | Treat display-name change and source/document renaming as separately scoped work. Accepted ADRs remain history; never rewrite their decision rationale retroactively. |

**Provenance:** MEANT is a layout and typography reference. This repository does not copy that application's code. Do not import its Next.js pages, Vercel authentication, Postgres queries, Groq coach route, or companion overlay. The desktop pet in [ADR-011](adr/ADR-011-coach-companion-and-system-one.md) may reuse the tomato sprite. If it does, the README names the file. Do not copy prior product metrics.

## 14. Verification checklist

### Visual checks

- [ ] Header matches the selected screenshot's warm frame, contour icon, split wordmark, active capsule and network pill.
- [ ] Heading hierarchy matches: large serif month, thin mono panel labels, readable body figures.
- [ ] Cards retain the **monthly → overlay → daily → bottom three** layout at wide size.
- [ ] Overlay has *two readable layers*, with non-color labels and a clearly differentiated Not recorded state.
- [ ] Cream / Coral / Dusty Blue tones are consistent; Dusty Blue stays in the wordmark and status data stays neutral.
- [ ] Reference canvas and actual 960×700 are both inspected; actual app is scrollable and fully operable.
- [ ] Nothing suggests an online account, cloud service, grade, or performance comparison. The companion, if shown, is the separate pet window, not a character inside the dashboard or the review.

### Behavior and trust checks

- [ ] Can start with empty intention and with missing model; Running stays silent.
- [ ] Review always renders intention + observed windows + source, including gaps/unclear/pending.
- [ ] Tap changes `shown` label to the user's choice and source `user` without claiming immediate memory.
- [ ] Closing Review unanswered remains unanswered; Yes/Not yet do not produce praise.
- [ ] No sample values ship as real analytics; every summary agrees with the underlying visit/session rows.
- [ ] No chart displays an unapproved rate, streak, or focus score.
- [ ] Network status and local data file path reflect the actual runtime.
- [ ] Full mouse/keyboard path and forced-colors operation checked at 100–200% scaling.
- [ ] Search, Patterns, Field Notes, and new routes remain nonfunctional/omitted until scoped and implemented.
- [ ] Renaming does not orphan `ledger.db`, the native host, or stored settings.

## 15. Decisions still needed before full screenshot-parity implementation

These are explicit **product/technical decision gates**. They are not automatically resolved by approving the image.

| ID | Decision | Conservative behavior now | Owner to approve |
|---|---|---|---|
| D-01 | Are runtime attended-time bars, hour ticks and totals permitted despite BR-006/F-013? | Use session counts in the same monthly chart silhouette. | Product / PRD owner |
| D-02 | Can the `Attention breakdown` donut show proportional time? What denominator? | Keep lower-right card but show static two-contour emblem and absolute label list. | Product / PRD owner |
| D-03 | Should `Dashboard · Ledger` become separate destinations, or one combined overview + day drill-down? | Put chosen dashboard at `history` initially; add route only after approved mapping. | Product + system-design owner |
| D-04 | What are `Patterns` and `Field Notes` exactly? | Omit from live app / show disabled in design-only prototype; no invented AI journaling. | Product owner |
| D-05 | What is a switch, detour, and partial unclear detour? | Show individual visits and labels, without fabricated aggregate. | Product owner, capture/system owner |
| D-06 | Does the Mascot-board palette (Dusty Blue lower wordmark, Coral/Tan warm accent) replace earlier teal/terracotta tokens? | This document proposes **yes** visually, pending asset and contrast review. | Brand/design owner |
| D-07 | When to rename repository/code/local storage from Ledger to Twofold? | Display-only name first; retain existing persistent storage. | Architecture owner |
| D-08 | What is the exact example-free month/day aggregation, timezone, cross-midnight rule? | Only render ranges whose definitions are checked and supported. | Product + data owner |
| D-09 | Is the right circle a privacy/settings shortcut rather than a profile? | Yes, **no account**. | Product owner |
| D-10 | Is the screenshot subtitle approved copy, or a placeholder? | Use a factual descriptive subtitle; never infer it from logs. | Product owner |

**Implementation order after decisions:** (1) assets/tokens/app shell, (2) Review fidelity, (3) History/Dashboard populated by real local rows, (4) daily drill-down, (5) optional additional destination screens. Do not add decorative summary analytics before the core Review works. This matches Must-vs-Should priorities in the PRD.

## 16. Documentation integrity and references

- [x] Every current PRD screen has a visual description or explicit existing design constraint here.
- [x] Routes and API claims checked against current `electron/windows.ts`, `src/App.tsx`, `src/shared/types.ts` and `docs/system-design.md`.
- [x] User-selected screenshot governs appearance, while PRD/ADRs govern behavior.
- [x] All Dashboard-only and screenshot-only functions are marked proposed, deferred or blocked.
- [x] No new schema, account, sync, third-party analytics, or app feature is silently asserted.
- [x] Brand fonts have an identified upstream source; local packaging is implementation work.
- [x] Visual contrast numbers are estimates calculated from the proposed color pairs, not a completed accessibility test.
- [ ] Accepted product owner decisions for §15 still pending.
- [ ] Real app rendering, Windows scaling and assistive-technology testing still pending.

**Canonical internal references:**

- [Product requirements](prd.md) (features, BR rules, screens, acceptance criteria)
- [System design](system-design.md) (Electron, IPC, renderer network block, windows, data flow)
- [Data model](data-model.md) (local stored entities, verdict display data)
- [Doc index](index.md) (ownership/decision precedence)
- [ADR-001: silent review](adr/ADR-001-silent-review.md)
- [ADR-002: harness order](adr/ADR-002-harness-order.md)
- [ADR-007: Windows first](adr/ADR-007-windows-first.md)
- [ADR-008: awareness over accountability](adr/ADR-008-awareness-over-accountability.md)
- [Source brief](../idea.md)

**External visual/layout reference:** the **user-selected Twofold warm-cream dashboard image** attached to the design request on 2026-10-10. **Do not claim that this image is checked into the repository.**

**MEANT reference files (read for design continuity, not code reuse):**

- [`meant/app/layout.tsx`](https://github.com/Alexandre-Nevero/meant/blob/main/app/layout.tsx): Fraunces, Public Sans, Sometype Mono font pairing.
- [`meant/design/tokens.css`](https://github.com/Alexandre-Nevero/meant/blob/main/design/tokens.css): prior paper/capsule/timing rules. **Do not copy old clay-as-verdict semantics.**
- [`meant/app/dashboard/page.tsx`](https://github.com/Alexandre-Nevero/meant/blob/main/app/dashboard/page.tsx) and [`meant/app/ledger/page.tsx`](https://github.com/Alexandre-Nevero/meant/blob/main/app/ledger/page.tsx): reference information architecture only.

**Doc change note:** This replaces the 2026-10-09 `docs/design.md` proposal (“system colors, system font, no visual source”) because a concrete user-selected visual reference now exists. The previous **product decisions** are retained; conflicts are named and gated above. No code or other canonical documents are claimed to have changed with this file.
