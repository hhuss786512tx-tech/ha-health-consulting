# 006 — Extract the two dominant easing curves into :root tokens

- **Status**: DONE
- **Commit**: c7cf05e
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file (css/site.css)

## Problem

Two cubic-beziers are hand-typed throughout this file instead of living as
tokens alongside the existing design tokens (`--brand`, `--shadow-card`,
etc. already in `:root`):

- `cubic-bezier(0.34,1.56,0.64,1)` — the bouncy button-press curve, appears
  on all 4 button variants (`.btn-primary`, `.btn-outline`, `.btn-dark`,
  `.btn-ghost`).
- `cubic-bezier(0.16,1,0.3,1)` — the strong ease-out curve, appears on
  `.reveal`, `header`, `.mobile-menu`, `.lead-modal`, `.intro-splash`
  children, `.biz-card-3d`, `.card-premium`, and (after plan 002) `.lead-step`.

No visible UX change from this plan — pure consolidation for future
maintainability, matching how every other repeated value in this file
(colors, shadows) is already tokenized.

## Target

Add two custom properties to the existing `:root` block, then replace every
occurrence of the two literal cubic-beziers with `var(--ease-spring)` /
`var(--ease-out)`.

```css
/* target — add to :root, alongside the existing tokens */
:root{
  --ink:#12142e;
  --ink-soft:#4a4d68;
  --paper:#f7f6f2;
  --paper-raised:#ffffff;
  --brand:#1a1c4d;
  --brand-deep:#08082c;
  --accent:#c31a21;
  --accent-hover:#a5151b;
  --accent-soft:#f0a3a7;
  --line:#dcdae0;

  --ease-spring: cubic-bezier(0.34,1.56,0.64,1);
  --ease-out: cubic-bezier(0.16,1,0.3,1);

  --shadow-card: 0 1px 2px rgba(8,8,44,0.05), 0 10px 24px -8px rgba(8,8,44,0.16), 0 28px 56px -28px rgba(8,8,44,0.2);
  --shadow-card-hover: 0 2px 4px rgba(8,8,44,0.08), 0 18px 36px -10px rgba(8,8,44,0.22), 0 36px 72px -28px rgba(8,8,44,0.26);
  --shadow-glow-accent: 0 0 0 1px rgba(195,26,33,0.12), 0 16px 40px -12px rgba(195,26,33,0.35);
  --bezel-pad: 7px;
  --radius-shell: 1.5rem;
  --radius-core: calc(1.5rem - var(--bezel-pad));
}
```

Then every literal occurrence of `cubic-bezier(0.34,1.56,0.64,1)` becomes
`var(--ease-spring)`, and every literal occurrence of
`cubic-bezier(0.16,1,0.3,1)` becomes `var(--ease-out)`, with no other change
to the surrounding declaration.

## Repo conventions to follow

- This is exactly how every other repeated value in the file is already
  handled — see `--shadow-card` / `--shadow-card-hover` at the top of
  `:root`, referenced via `var(--shadow-card)` in `.card-premium` and the
  timeline card. New easing tokens should sit in `:root` the same way,
  named `--ease-*` to match this repo's existing `--ink-soft` /
  `--brand-deep` naming style (role-based, not numbered).

## Steps

1. Add the two `--ease-spring` / `--ease-out` lines to the `:root` block at
   the top of `css/site.css`, placed after the color tokens and before
   `--shadow-card` (matching the Target layout above).
2. Run a find-and-replace across the whole file:
   `cubic-bezier(0.34,1.56,0.64,1)` → `var(--ease-spring)`
   `cubic-bezier(0.16,1,0.3,1)` → `var(--ease-out)`
   Every occurrence, no exceptions — do not leave any literal copies of
   either curve behind.
3. Re-grep the file for both literal cubic-bezier strings afterward to
   confirm zero remain.

## Boundaries

- Do NOT introduce a third/new easing curve — this plan only tokenizes the
  two that already exist.
- Do NOT change any duration values, only the easing-function portion of
  each `transition`/`animation` declaration.
- Do NOT touch curves that are neither of these two exact values (e.g. plain
  `ease`, `linear`, or the `0.6s ease` used for button background-position
  shimmer) — those are intentionally different per AUDIT.md's "hover/color
  change → ease" guidance and are out of scope.

## Verification

- **Mechanical**:
  `grep -c "cubic-bezier(0.34,1.56,0.64,1)" css/site.css` → must print `0`.
  `grep -c "cubic-bezier(0.16,1,0.3,1)" css/site.css` → must print `0`.
  `grep -c "var(--ease-spring)" css/site.css` and
  `grep -c "var(--ease-out)" css/site.css` → both should be > 5.
  `node serve.mjs`, load the page — no console errors.
- **Feel check**: spot-check 3 previously-bouncy elements (a button hover,
  the lead modal open, the mobile menu open) — confirm the motion feel is
  byte-for-byte identical to before this plan (this is a pure refactor, any
  visible difference is a bug).
- **Done when**: both literal cubic-beziers are gone from the file, both
  tokens are defined once in `:root`, and every animation that used to
  reference them now references the token with no visual change.
