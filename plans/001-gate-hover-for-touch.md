# 001 — Gate hover effects behind (hover: hover) and (pointer: fine)

- **Status**: DONE
- **Commit**: c7cf05e
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 1 file (css/site.css), ~6 rule blocks

## Problem

None of the `:hover` rules in `css/site.css` are gated for touch devices. On a
tap, mobile Safari/Chrome fire a synthetic hover state that then sticks until
the user taps elsewhere on the page — the button stays lifted, the card stays
elevated, the nav underline stays drawn. This hits every visitor on a phone,
which for a B2B consulting site is a meaningful share of traffic.

Current code, verbatim:

```css
/* css/site.css:120 — .btn-ghost */
.btn-ghost:hover{ background-position:100% 0%; color:var(--ink); transform: translateY(-2px); }

/* css/site.css:77 — .btn-primary */
.btn-primary:hover{
  background-position:100% 0%;
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 14px 32px -6px rgba(195,26,33,0.55);
}

/* css/site.css:91 — .btn-outline */
.btn-outline:hover{
  background-position:100% 0%;
  transform: translateY(-3px) scale(1.02);
  border-color:rgba(247,245,239,0.7);
  box-shadow: 0 10px 26px -8px rgba(247,245,239,0.22);
}

/* css/site.css:106 — .btn-dark */
.btn-dark:hover{
  background-position:100% 0%;
  transform: translateY(-3px) scale(1.02);
  border-color:rgba(240,163,167,0.75);
  box-shadow: 0 14px 32px -8px rgba(195,26,33,0.35);
}

/* css/site.css:135-136 — .nav-link */
.nav-link:hover{ color:var(--ink); }
.nav-link:hover::after{ transform:scaleX(1); }

/* css/site.css:145 — .card */
.card:hover{ transform: translateY(-4px); border-color: rgba(8,8,44,0.2); }

/* css/site.css:253-254 — .partner-logo */
.partner-logo{ filter:grayscale(1); opacity:0.55; transition: filter 0.3s ease, opacity 0.3s ease; flex-shrink:0; }
.partner-logo:hover{ filter:grayscale(0); opacity:1; }

/* css/site.css:458-459 — .card-premium */
.card-premium:hover{ transform:translateY(-6px); box-shadow:var(--shadow-card-hover); }
.card-premium:hover .card-premium-inner{ border-color:rgba(195,26,33,0.3); }
```

## Target

Every rule above moved inside a single shared media query per selector group,
using the exact query from AUDIT.md:

```css
@media (hover: hover) and (pointer: fine) {
  .btn-ghost:hover{ background-position:100% 0%; color:var(--ink); transform: translateY(-2px); }

  .btn-primary:hover{
    background-position:100% 0%;
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 14px 32px -6px rgba(195,26,33,0.55);
  }

  .btn-outline:hover{
    background-position:100% 0%;
    transform: translateY(-3px) scale(1.02);
    border-color:rgba(247,245,239,0.7);
    box-shadow: 0 10px 26px -8px rgba(247,245,239,0.22);
  }

  .btn-dark:hover{
    background-position:100% 0%;
    transform: translateY(-3px) scale(1.02);
    border-color:rgba(240,163,167,0.75);
    box-shadow: 0 14px 32px -8px rgba(195,26,33,0.35);
  }

  .nav-link:hover{ color:var(--ink); }
  .nav-link:hover::after{ transform:scaleX(1); }

  .card:hover{ transform: translateY(-4px); border-color: rgba(8,8,44,0.2); }

  .partner-logo:hover{ filter:grayscale(0); opacity:1; }

  .card-premium:hover{ transform:translateY(-6px); box-shadow:var(--shadow-card-hover); }
  .card-premium:hover .card-premium-inner{ border-color:rgba(195,26,33,0.3); }
}
```

Note `.nav-link.is-active::after{ transform:scaleX(1); }` (css/site.css:137)
and `.biz-card-3d-wrap:hover .biz-card-3d, .biz-card-3d-wrap.is-tilting .biz-card-3d`
(css/site.css:378-379) are driven by JS-toggled classes or a non-hover state,
not a bare CSS `:hover` — leave those exactly as they are.

## Repo conventions to follow

This codebase already gates motion by input capability in exactly this way —
follow the same pattern used for `prefers-reduced-motion` and `pointer: coarse`:

- `css/site.css:360` — `@media (pointer: coarse), (prefers-reduced-motion: reduce){ .cursor-ring{ display:none; } }`
- `css/site.css:387-389` — `@media (pointer: coarse){ .biz-card-3d{ transform:rotateX(4deg) rotateY(-8deg); } }`

## Steps

1. Open `css/site.css`. For each of the 8 rule blocks quoted above (btn-ghost,
   btn-primary, btn-outline, btn-dark, nav-link, card, partner-logo,
   card-premium), remove the bare `:hover` rule from its current location.
2. Add one new block near the bottom of the file (after the last existing
   rule, before EOF) containing `@media (hover: hover) and (pointer: fine) { ... }`
   with all 8 rule bodies moved inside it, verbatim as shown in Target.
3. Do not touch the non-`:hover` rules on these same selectors (base styles,
   `:active`, `:focus-visible`, `.is-tilting` — leave exactly where they are).
4. Re-read the file to confirm no duplicate selector was left outside the
   media query.

## Boundaries

- Do NOT touch `js/site.js` — this is a pure CSS change.
- Do NOT touch any `:active`, `:focus-visible`, or `.is-*` class-driven rule —
  only bare `:hover` selectors move.
- Do NOT change colors, durations, or easing curves — only add the media
  query wrapper.
- If a selector listed above has drifted (different property values than
  quoted), STOP and report instead of guessing which version is current.

## Verification

- **Mechanical**: `python3 -m http.server` (or `node serve.mjs`) from the repo
  root, open `http://localhost:3000` — page should load with no console CSS
  errors.
- **Feel check**:
  - In Chrome DevTools, open Rendering panel → "Emulate CSS media feature
    pointer" → set to "coarse". Reload the page and hover (with a real mouse)
    over a button, nav link, and card — confirm none of them show a hover
    state (no lift, no color shift, no underline).
  - Set the emulation back to "No emulation" (or "fine") — confirm hover
    states are back and work exactly as before on desktop.
  - On an actual touch device or Chrome's device toolbar touch simulation,
    tap a button and tap elsewhere — confirm the button does not visibly
    "stick" in a lifted/hovered state after the tap.
- **Done when**: all 8 hover blocks live inside the single
  `@media (hover: hover) and (pointer: fine)` block, desktop hover behavior
  is pixel-identical to before, and touch-emulated hover no longer applies
  lift/shadow/color-shift on tap.
