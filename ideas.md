# RANEEV UI/UX Direction

## Three candidate approaches

### Approach 1 — Clinical Wayfinding
**Very Brief Intro:** A high-reliability clinical interface shaped by emergency-department wayfinding, operational maps, and transit control rooms. It is deliberately calm under pressure: typography, color, and spatial hierarchy carry the urgency instead of decorative effects.

**Probability:** 0.07

### Approach 2 — Field Journal
**Very Brief Intro:** A warm, paper-informed community response system that combines practical checklists with humane, local-network cues. It builds trust through familiar materials, restrained blue ink, and clear handwritten-inspired annotation moments.

**Probability:** 0.04

### Approach 3 — Signal Grid
**Very Brief Intro:** A compact operational console defined by dense status rails, strong geometric modules, and a black-and-white information substrate with limited high-visibility color. It feels engineered for dispatch teams and field coordination.

**Probability:** 0.09

---

## Chosen approach — Clinical Wayfinding

### Design Movement

**Swiss International Typographic Style adapted for high-reliability healthcare and transit wayfinding.** It uses forceful typographic hierarchy, disciplined alignment, generous negative space, and a tightly constrained color system to make time-sensitive choices legible at a glance.

### Core Principles

1. **Urgency has one visual language.** Red is reserved for irreversible or actively critical moments; routine interface actions never compete with it.
2. **Route people, do not decorate screens.** Clear status rails, directional labels, task steps, and visible escape paths make every interface understandable under stress.
3. **Make state physically apparent.** Status is expressed with color, icon, label, time, and placement together; no user should rely on color alone.
4. **Prioritize decisive action.** Primary touch targets are large, high-contrast, and separated from secondary or destructive actions.

### Color Philosophy

The base is warm-white and graphite rather than stark blue-white, reducing eye fatigue while preserving clinical clarity. **Response Red** signifies a live emergency and must never become a decorative accent. Amber marks attention and incomplete action; green confirms availability and safe resolution; deep maritime blue carries navigation and informational actions. Structural neutral tones hold the interface together without diluting semantic colors.

### Layout Paradigm

Use a **command spine** rather than a centered-card dashboard. On desktop, a slim navigation rail supports a wide operational field with a right-side context column for critical status or map context. On mobile, the same hierarchy collapses into a persistent top incident bar and a bottom action dock. Public pages use asymmetrical editorial panels rather than generic centered marketing bands.

### Signature Elements

1. **Status rail:** a narrow, color-coded vertical edge on active incident cards and operational panels.
2. **Coordinate line:** small monospaced timestamps, incident IDs, and location metadata that ground urgent information in verified facts.
3. **Pulse markers:** a static concentric marker motif for incidents and responders on maps, used as an emblem rather than a glowing animation.

### Interaction Philosophy

Interactions should acknowledge a decision immediately and retain a safe undo or back route when possible. High-risk actions require an explicit confirmation surface with plain-language consequences. Rescue-critical actions use hold-to-confirm patterns; all routine actions remain single-tap and predictable.

### Animation

Motion is restrained and functional. Panels enter with a 160–220 ms opacity/transform transition, drawers use a 240 ms slide, and buttons compress slightly on press. Emergency states do not flash, pulse endlessly, or create visual noise. Reduced-motion preferences remove all non-essential movement.

### Typography System

**Manrope** is the high-legibility interface and heading family, selected for its open counters and strong numeral forms. **IBM Plex Mono** is reserved for coordinates, incident identifiers, timestamps, and operational metadata. Headings use 700–800 weight with tight but readable tracking; body copy uses 500–600 at comfortable line-height. No generic Inter default is used.

### Brand Essence

**RANEEV is the calm command layer that connects people in distress with verified nearby help before professional care arrives.**

Personality: **decisive, reassuring, accountable.**

### Brand Voice

Headlines are direct and time-aware; CTAs name the action and its scope; microcopy says what the system knows and what happens next. Avoid vague promises or cheerful filler.

Example lines:

> “Request verified nearby help.”

> “Responder search begins after you confirm this location.”

### Wordmark & Logo

The mark is a **four-point response compass**: four rounded directional arms form a protected center, signaling coordination, proximity, and calm orientation without resembling a medical cross. The wordmark uses a custom all-caps, widened Manrope treatment with deliberate tracking; the mark appears alone in compact contexts.

### Signature Brand Color

**Signal Red — #D83232.** This is RANEEV’s protected emergency color and appears only for active emergency indicators and deliberate emergency actions.

## Style Decisions

- Production-facing screens treat preview-only information as **quiet operational metadata**, never as a primary badge, heading, or full-width test panel.
- Surfaces favor **flat Swiss command panels**, linear dividers, status rails, context bands, and coordinate metadata over decorative shadows, soft dashboards, and pill-heavy treatment.
- Every headline and CTA names the user’s **operational situation or next verified action**; casual greetings and vague product language are excluded.
