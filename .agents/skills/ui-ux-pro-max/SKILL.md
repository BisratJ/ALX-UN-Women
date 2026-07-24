---
name: ui-ux-pro-max
description: >
  Premium UI/UX design system skill for building world-class, award-worthy web dashboards and applications.
  Activate when the user asks to improve the look, feel, layout, animations, components, or visual quality
  of any web UI. Covers: glassmorphism, dark mode systems, micro-animations, typography hierarchy,
  color science, data visualization aesthetics, responsive grid systems, and component-level design excellence.
  Trigger on: "improve UI", "make it prettier", "refine design", "better UX", "add animations",
  "upgrade the look", "pro max design", "make it premium", "better layout", "more modern".
---

# UI/UX Pro Max Skill

## Core Design Philosophy

This skill encodes **award-level UI/UX design** practices. Every decision should feel intentional, refined, and premium. The goal is to produce interfaces that make users stop and say *"this is beautiful."*

---

## 1. Color Science

### Dark Mode Palette Principles
- **Base canvas**: `#09090B` – `#0D1117` (near-black zinc/obsidian)
- **Surface 1** (cards): `#111318` – `#161B22` (elevated dark slate)
- **Surface 2** (inputs, inset): `#0E1119` – `#1A2030` (recessed)
- **Border default**: `#1E2433` – `#252E3E` (subtle, barely visible)
- **Border active**: Same hue as accent at 40% opacity
- **Text hierarchy**:
  - Primary: `#E2E8F0` (bright slate-white, never pure white)
  - Secondary: `#94A3B8` (slate-400)
  - Muted: `#64748B` (slate-500)
  - Disabled: `#334155` (slate-700)

### Accent Color Rules
- **Never use raw saturated colors** (no `#FF0000`, `#0000FF`, `#00FF00`)
- Use **tinted, deep hues**: `#2563EB` (blue-600), `#7C3AED` (violet-600), `#0D9488` (teal-600)
- Status colors: emerald `#10B981`, amber `#D97706`, rose `#DC2626`, slate `#64748B`
- Glows & shadows: `box-shadow: 0 0 20px -4px rgba(accent, 0.15)` — keep subtle

### Gradient Patterns
```css
/* Premium card gradient */
background: linear-gradient(135deg, #12171F 0%, #1A2030 100%);

/* Subtle text gradient */
background: linear-gradient(135deg, #E2E8F0, #94A3B8);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;

/* Accent glow overlay */
background: radial-gradient(circle at 30% 0%, rgba(37,99,235,0.08) 0%, transparent 60%);
```

---

## 2. Typography System

### Font Stack
- **Primary**: `'Inter'` or `'Poppins'` (already loaded in this project)
- **Mono**: `'JetBrains Mono'`, `'Fira Code'` for data/numbers
- **Never use**: system-ui alone, or Times New Roman, or Arial for UI

### Type Scale
```
Display:  40–48px / weight 800-900 / tracking -0.04em
H1:       28–32px / weight 700-800 / tracking -0.03em
H2:       20–24px / weight 700   / tracking -0.02em
H3:       16–18px / weight 600   / tracking -0.01em
Body:     13–14px / weight 400   / tracking  0em
Label:    11–12px / weight 600   / tracking +0.04em (uppercase)
Micro:    10–11px / weight 500   / tracking +0.02em
```

### Number Display Rules
- KPI numbers: `font-variant-numeric: tabular-nums` always
- Large metrics: pair with `font-feature-settings: 'tnum'`
- Animate numbers: always count up from 0 on mount

---

## 3. Spacing & Layout

### Grid System
```css
/* Base unit: 4px */
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;
--space-4: 16px;  --space-5: 20px;  --space-6: 24px;
--space-8: 32px;  --space-10: 40px; --space-12: 48px;
```

### Card Anatomy
- Padding: `20px–24px` (never less than 16px)
- Border radius: `12px–16px` for cards, `8px` for inputs/buttons, `999px` for pills
- Border: `1px solid` with 12–20% opacity border color
- Background: base surface + optional subtle gradient overlay

### Responsive Breakpoints
```css
/* Mobile first */
@media (min-width: 640px)  { /* sm */  }
@media (min-width: 768px)  { /* md */  }
@media (min-width: 1024px) { /* lg */  }
@media (min-width: 1280px) { /* xl */  }
@media (min-width: 1536px) { /* 2xl */ }
```

---

## 4. Component Patterns

### KPI / Metric Cards
```html
<!-- Anatomy: left accent bar + icon bubble + value + label + trend -->
<div class="kpi-card" style="--accent: #2563EB">
  <div class="kpi-accent-bar"></div>
  <div class="kpi-header">
    <span class="kpi-label">METRIC NAME</span>
    <div class="kpi-icon">📊</div>
  </div>
  <div class="kpi-value" data-target="512">0</div>
  <div class="kpi-sub">Supporting context text</div>
</div>
```

### Status Badges
```html
<!-- Always: dot + label, never just color alone -->
<span class="badge badge-success">
  <span class="badge-dot"></span>
  Healthy / On-Track
</span>
```
- Min width: 80px to avoid layout shift
- Font: weight 600, size 11px, uppercase or sentence case

### Data Tables
- Zebra striping: `rgba(255,255,255,0.015)` on alternate rows
- Hover: `rgba(255,255,255,0.03)` background transition
- Column headers: ALL CAPS, letter-spacing 0.05em, muted color
- Sticky header: always for tables > 6 rows
- Row height: 44px minimum (tap target)

### Filter Chips / Pill Selectors
```css
.chip-group { background: var(--surface-2); padding: 3px; border-radius: 8px; }
.chip       { padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; }
.chip.active { background: accent; color: white; }
```

---

## 5. Animation System (Motion One)

This project uses **Motion One** (`window.Motion`) for animations.

### Animation Tokens
```js
const EASING = {
  smooth:  [0.22, 1, 0.36, 1],     // ease out expo — for enter animations
  spring:  [0.34, 1.56, 0.64, 1],  // spring overshoot — for interactive elements
  snappy:  [0.4, 0, 0.2, 1],       // material standard — for state changes
  linear:  'linear',                // for progress bars, loaders
};

const DURATION = {
  instant:  0.1,   // state indicators
  fast:     0.2,   // hover states, button presses
  normal:   0.35,  // card enters, modals
  slow:     0.5,   // page sections, hero content
  crawl:    0.8,   // bars, counters, reveals
};
```

### Standard Animation Patterns
```js
// Page section entrance (use on mount)
Motion.animate(section, { opacity: [0,1], y: [24,0] }, { duration: 0.5, easing: SMOOTH });

// Card stagger (use for grids)
Motion.animate(cards, { opacity: [0,1], scale: [0.94,1] }, { 
  duration: 0.4, delay: Motion.stagger(0.06), easing: SPRING 
});

// Funnel bar reveal (use for progress bars)
Motion.animate(bar, { width: ['0%', targetPct] }, { duration: 0.8, easing: SMOOTH });

// Table row cascade (use after filter/sort)
Motion.animate(rows, { opacity: [0,1], x: [-8,0] }, { 
  duration: 0.25, delay: Motion.stagger(0.025), easing: SNAPPY 
});

// Number counter (use for KPI values)
Motion.animate((p) => { el.textContent = Math.round(p * target); }, { duration: 1.2, easing: SMOOTH });
```

### Rules
- **Never animate** `width/height` on layout-critical elements without `will-change: transform`
- Prefer `transform` and `opacity` for 60fps performance
- Use `stagger` for any list of 3+ items
- Maximum stagger delay total: 400ms (don't make users wait)
- Respect `prefers-reduced-motion`:
  ```css
  @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; } }
  ```

---

## 6. Micro-Interaction Patterns

### Hover States
```css
/* Cards */
.card { transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease; }
.card:hover { transform: translateY(-2px); border-color: var(--accent); }

/* Buttons */
.btn { transition: all 0.15s ease; }
.btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
.btn:active { transform: translateY(0px) scale(0.98); }

/* Rows */
tr { transition: background 0.1s ease; }
tr:hover td { background: rgba(255,255,255,0.025); }
```

### Focus States (Accessibility)
```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
```

### Loading States
- Skeleton screens > spinners for content-heavy areas
- Pulse animation: `animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`
- Progress bars: always show estimated completion

---

## 7. Glassmorphism Patterns

```css
/* Full glass card */
.glass-card {
  background: rgba(18, 23, 33, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

/* Subtle glass (inputs, pills) */
.glass-subtle {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
```

---

## 8. Data Visualization Aesthetics

### Chart Color Sequences (for Chart.js / D3)
```js
const CHART_PALETTE = {
  primary:   ['#10B981', '#DC2626', '#D97706', '#64748B', '#2563EB', '#7C3AED'],
  muted:     ['#1E7356', '#8B1A1A', '#8A5200', '#3D4F60', '#1A3B7A', '#4A1D7A'],
  gradients: ['rgba(16,185,129,0.8)', 'rgba(220,38,38,0.8)', ...],
};
```

### Chart Styling Rules
- No chart borders or gridlines by default — use subtle `rgba(255,255,255,0.05)`
- Doughnut charts: cutout `75%`, inner label overlay showing total count
- Bar charts: rounded bars (`borderRadius: 6`), subtle bar width
- Tooltips: dark glass background, never default white
- Legends: custom HTML legends, not Chart.js built-in

---

## 9. Implementation Workflow for This Project

When applying this skill to the ALX × UN Women dashboard:

1. **Audit current CSS variables** in `styles.css` — check color tokens match above principles
2. **Verify Motion One** is loaded and `window.Motion` is available in `app.js`
3. **Check typography** — Poppins weights loaded, hierarchy applied correctly
4. **Review KPI cards** — accent bar, icon bubble, animated counter, hover state
5. **Review table** — sticky header, zebra rows, row hover, badge anatomy
6. **Review funnels** — bars animate on mount and on track switch
7. **Test responsiveness** — check 375px, 768px, 1280px, 1440px viewports
8. **Test reduced motion** — disable animations for accessibility
9. **Push to GitHub** — commit changes, push `main:gh-pages` for live deploy

---

## 10. Quality Checklist

Before considering any UI work complete:

- [ ] No raw saturated colors (`#FF0000` etc.)
- [ ] All interactive elements have `transition` on hover/focus
- [ ] Typography follows the scale — no arbitrary font sizes
- [ ] Animations use `opacity` + `transform` only (no width/height tweening for layout)
- [ ] Motion stagger never exceeds 400ms total delay
- [ ] All badges have a colored dot + label (never color-only)
- [ ] Focus states are visible (`outline: 2px solid accent`)
- [ ] Responsive at 375px mobile
- [ ] `prefers-reduced-motion` respected
- [ ] No layout shift on filter/sort updates
