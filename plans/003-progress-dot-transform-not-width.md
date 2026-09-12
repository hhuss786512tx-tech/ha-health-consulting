# 003 — Animate lead-progress-dot with transform, not width

- **Status**: DONE
- **Commit**: c7cf05e
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file (css/site.css)

## Problem

The lead-popup's step-progress dot animates `width` on activation — a
layout-triggering property (the exact violation AUDIT.md's Performance
section calls out: "Animate `transform` and `opacity` only... `width` ...
trigger layout + paint + composite"). Low cost given the element's tiny size,
but free to fix correctly.

Current code, verbatim:

```css
/* css/site.css:299 (post-plan-001 line numbers may shift; match by content) — current */
.lead-progress-dot{ width:6px; height:6px; border-radius:999px; background:var(--line); transition: background 0.2s ease, width 0.2s ease; }
.lead-progress-dot.is-active{ background:var(--accent); width:18px; }
```

## Target

Fixed width, animate a `transform: scaleX()` from a left-anchored origin
instead:

```css
/* target */
.lead-progress-dot{
  width:18px; height:6px; border-radius:999px; background:var(--line);
  transform-origin:left center;
  transform:scaleX(0.333); /* 6px / 18px, resting "unfilled" state */
  transition: background 0.2s ease, transform 0.2s ease;
}
.lead-progress-dot.is-active{ background:var(--accent); transform:scaleX(1); }
```

This keeps the exact same visual result (a 6px dot that grows to an 18px
pill) but the box itself is always 18px wide and layout never recalculates —
only `transform` changes.

## Repo conventions to follow

- This file already prefers `transform: scaleX(...)` with an explicit
  `transform-origin` for exactly this kind of fill/reveal effect — see
  `css/site.css:189` (`.scroll-progress`): `transform-origin:left; transform:scaleX(0);`
  and its JS driver at `js/site.js:198` (`progress.style.transform = 'scaleX(' + ... + ')'`).
  Follow that pattern's spirit even though this one stays pure-CSS
  (class-toggle driven, not JS-driven per-frame).

## Steps

1. In `css/site.css`, find `.lead-progress-dot` and `.lead-progress-dot.is-active`
   (grep for `lead-progress-dot` if line numbers have shifted from earlier
   plans in this batch).
2. Replace both rules with the Target block above verbatim.

## Boundaries

- Do NOT change the dot's color values (`var(--line)`, `var(--accent)`) —
  transform/sizing only.
- Do NOT touch `js/site.js` — the dot's active state is already
  driven by a class toggle in `goToStep` (untouched by this plan), no JS
  change needed here.
- Do NOT change the gap/spacing between the 3 dots (not shown in the quoted
  rule — leave whatever margin/gap rule exists elsewhere untouched).

## Verification

- **Mechanical**: `node serve.mjs`, open a page, open the lead popup — no
  console errors, all 3 progress dots render.
- **Feel check**:
  - Step through the lead form (Next/Back) and watch the progress dots at
    the top of the modal — confirm the active dot still visually grows from
    a small circle to a short pill, same as before.
  - In DevTools Performance panel, record while stepping through the form —
    confirm no "Layout" (purple) entries are attributed to
    `.lead-progress-dot` (only "Composite Layers" / transform-related work).
- **Done when**: `.lead-progress-dot` has a fixed `width:18px` at all times,
  the visual fill effect is unchanged, and only `background`/`transform`
  transition.
