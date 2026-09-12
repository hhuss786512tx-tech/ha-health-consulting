# Animation plans

All 6 findings from the 2026-09-11 animation audit, implemented in order.

| # | Title | Severity | Status |
|---|---|---|---|
| 001 | Gate hover effects behind `(hover: hover) and (pointer: fine)` | HIGH | DONE |
| 002 | Crossfade between lead-form steps instead of hard display cut | HIGH | DONE |
| 003 | Animate lead-progress-dot with transform, not width | MEDIUM | DONE |
| 004 | Anchor mobile menu entrance to its trigger, not center | MEDIUM | DONE |
| 005 | Gate the idle 3D-tilt loop to only run while in viewport | LOW | DONE |
| 006 | Extract the two dominant easing curves into `:root` tokens | LOW | DONE |

## Execution order / dependencies

Executed 001 → 006 in numeric order, matching severity (highest leverage
first). Plan 002 references plan 006's `--ease-out` token but has its own
fallback to the literal cubic-bezier if run first — in practice 006 ran last,
so 002 was implemented with the literal value first, then correctly picked
up by 006's global find-and-replace (which doesn't distinguish "already
literal" from "written this session" — same string, same replacement).

No other cross-plan dependencies. All 6 touch only `css/site.css` and
`js/site.js`; no shared selector was edited by two plans.

## Notes from execution

- Plan 006's find-and-replace initially clobbered its own new token
  definitions (`--ease-spring: cubic-bezier(...)` became
  `--ease-spring: var(--ease-spring)`, a self-reference) because the sed
  pass ran over the whole file including the `:root` block it had just
  written. Caught immediately via grep verification and fixed before commit.
  If re-running this pattern in future, add the tokens to `:root` in a
  separate pass *after* the find-and-replace, not before, or exclude the
  `:root` block from the replacement range.
- All mechanical verification (JS syntax, CSS brace balance, local page
  loads) passed after each step. Feel-check items in each plan (touch-hover
  behavior, DevTools slow-motion inspection, reduced-motion toggling) still
  need a human pass in a real browser — not something a text-only check can
  confirm.
