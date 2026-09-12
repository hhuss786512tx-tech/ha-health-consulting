# 004 — Anchor mobile menu entrance to its trigger, not center

- **Status**: DONE
- **Commit**: c7cf05e
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 file (css/site.css)

## Problem

The mobile nav menu scales in from `scale(0.98)` with no `transform-origin`
set, so it defaults to `center` — but this menu visually drops down from the
header/hamburger button above it, not from its own middle. AUDIT.md is
explicit: "Popovers/dropdowns/tooltips scale from their trigger, not center"
(modals are the only exemption, and this is a dropdown-style menu, not a
centered modal).

Current code, verbatim:

```css
/* css/site.css:212-222 — current */
.mobile-menu{
  position:fixed; top:calc(5rem + 0.75rem); left:1rem; right:1rem; z-index:49;
  display:flex; flex-direction:column; gap:0.25rem;
  background:rgba(247,246,242,0.94); backdrop-filter: blur(20px) saturate(180%);
  border:1px solid var(--line); border-radius:1.25rem; padding:0.75rem;
  box-shadow: 0 2px 4px rgba(8,8,44,0.08), 0 16px 40px -12px rgba(8,8,44,0.28);
  opacity:0; transform: translateY(-10px) scale(0.98);
  pointer-events:none;
  transition: opacity 0.25s cubic-bezier(0.16,1,0.3,1), transform 0.25s cubic-bezier(0.16,1,0.3,1);
}
.mobile-menu.is-open{ opacity:1; transform:none; pointer-events:auto; }
```

## Target

Add an explicit top-anchored `transform-origin` so the scale reads as
growing downward from the header, matching the existing `translateY(-10px)`
(which already implies "coming from above"):

```css
/* target */
.mobile-menu{
  position:fixed; top:calc(5rem + 0.75rem); left:1rem; right:1rem; z-index:49;
  display:flex; flex-direction:column; gap:0.25rem;
  background:rgba(247,246,242,0.94); backdrop-filter: blur(20px) saturate(180%);
  border:1px solid var(--line); border-radius:1.25rem; padding:0.75rem;
  box-shadow: 0 2px 4px rgba(8,8,44,0.08), 0 16px 40px -12px rgba(8,8,44,0.28);
  opacity:0; transform: translateY(-10px) scale(0.98);
  transform-origin: top center;
  pointer-events:none;
  transition: opacity 0.25s cubic-bezier(0.16,1,0.3,1), transform 0.25s cubic-bezier(0.16,1,0.3,1);
}
.mobile-menu.is-open{ opacity:1; transform:none; pointer-events:auto; }
```

Only one line is added (`transform-origin: top center;`) — everything else
stays byte-for-byte identical.

## Repo conventions to follow

- This is the one dropdown-style panel in the codebase that was missing an
  origin; the lead modal (`css/site.css:279-289`) correctly uses the default
  center origin because AUDIT.md exempts centered modals — do not add an
  origin there, only here.

## Steps

1. In `css/site.css`, find the `.mobile-menu` rule (grep for `.mobile-menu{`
   if the line number has shifted).
2. Add `transform-origin: top center;` as a new line inside the rule, placed
   directly after the `transform:` line for readability. No other property
   changes.

## Boundaries

- Do NOT change the `translateY`/`scale` values, duration, or easing curve —
  origin only.
- Do NOT touch `.mobile-scrim` or `.mobile-nav-link` — this plan is scoped to
  `.mobile-menu` alone.
- Do NOT change the menu's positioning (`top`/`left`/`right` values).

## Verification

- **Mechanical**: `node serve.mjs`, resize viewport to mobile width (<768px)
  or use DevTools device toolbar, load the page — no console errors.
- **Feel check**:
  - Tap the hamburger menu button — confirm the menu now visibly grows
    downward from the top of its box rather than expanding evenly from its
    center. This is a subtle difference; slow the animation via DevTools
    Animations panel (set playback to 10%) to see it clearly frame-by-frame.
  - Close and reopen several times — confirm no layout jump or flicker was
    introduced.
- **Done when**: `.mobile-menu` has `transform-origin: top center`, the open/
  close animation timing is unchanged, and at 10% playback speed the scale
  visibly originates from the top edge rather than the vertical center.
