# 002 — Crossfade between lead-form steps instead of hard display cut

- **Status**: DONE
- **Commit**: c7cf05e
- **Severity**: HIGH
- **Category**: Missed opportunity / Interruptibility
- **Estimated scope**: 2 files (css/site.css, js/site.js)

## Problem

The 3-step lead-capture form — the single most conversion-critical UI on the
site — switches steps with a hard `display` toggle. No transition at all,
inside an otherwise carefully-animated modal (the modal itself scales/fades in
with a proper `cubic-bezier(0.16,1,0.3,1)` curve).

Current code, verbatim:

```css
/* css/site.css:294-295 — current */
.lead-step{ display:none; }
.lead-step.is-active{ display:block; }
```

```js
/* js/site.js:229-232 — current */
function goToStep(n){
  steps.forEach(function(s){ s.classList.toggle('is-active', s.dataset.step === String(n)); });
  dots.forEach(function(d){ d.classList.toggle('is-active', d.dataset.dot === String(n)); });
}
```

## Target

A CSS-transition-based crossfade + small horizontal slide, driven by adding
an `is-leaving` class before swapping `is-active`, so `goToStep` becomes a
two-phase JS function instead of an instant class toggle.

```css
/* target */
.lead-step{
  display:none;
  opacity:0;
  transform: translateX(12px);
  transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out);
}
.lead-step.is-active{ display:block; }
.lead-step.is-active.is-in{ opacity:1; transform:none; }
.lead-step.is-leaving{ opacity:0; transform: translateX(-12px); }
@media (prefers-reduced-motion: reduce){
  .lead-step{ transition:none; transform:none; }
}
```

If plan 006 (easing tokens) has already been applied when this plan runs,
`var(--ease-out)` will resolve to `cubic-bezier(0.16,1,0.3,1)` via the new
`:root` token. If plan 006 has NOT been applied yet, use the literal value
directly instead: `transition: opacity 200ms cubic-bezier(0.16,1,0.3,1), transform 200ms cubic-bezier(0.16,1,0.3,1);`
— check whether `--ease-out` exists in `css/site.css`'s `:root` block before
deciding which form to write.

```js
/* target */
function goToStep(n){
  var target = String(n);
  steps.forEach(function(s){
    if (s.dataset.step === target) {
      s.classList.add('is-active');
      // force layout so the browser registers the display:block before
      // adding is-in, or the opacity/transform transition won't run
      void s.offsetWidth;
      s.classList.add('is-in');
    } else if (s.classList.contains('is-active')) {
      s.classList.remove('is-in');
      s.classList.add('is-leaving');
      setTimeout(function(){
        s.classList.remove('is-active', 'is-leaving');
      }, 200);
    }
  });
  dots.forEach(function(d){ d.classList.toggle('is-active', d.dataset.dot === String(n)); });
}
```

## Repo conventions to follow

- The modal's own entrance already uses this exact curve and this exact
  duration family — imitate it: `css/site.css:287` —
  `transition: opacity 0.3s cubic-bezier(0.16,1,0.3,1), transform 0.3s cubic-bezier(0.16,1,0.3,1);`
- `setTimeout`-paired class removal after a CSS transition is already used
  elsewhere in this file for the same reason (waiting out a transition before
  cleanup) — see `js/site.js:252-255` (`closeLead` + `doneBtn` handler).

## Steps

1. In `css/site.css`, replace the two-line `.lead-step` rule (lines 294-295)
   with the Target block above. Check whether `--ease-out` already exists in
   the `:root` block first (see plan 006) and use the token if present,
   otherwise the literal cubic-bezier.
2. In `js/site.js`, replace the `goToStep` function body (lines 229-232) with
   the Target version above.
3. Leave every other part of the lead form (`openLead`, `closeLead`, the
   `.lead-next`/`.lead-back` click handlers, the `fetch` submit logic)
   untouched — they already call `goToStep(...)`, which is the only place
   that needs to change.

## Boundaries

- Do NOT change the modal's own open/close animation (`.lead-modal`,
  `.lead-scrim`) — only the internal step-to-step transition.
- Do NOT change the multi-step form's field order, validation, or submit
  logic.
- Do NOT add a JS animation library — this stays CSS-transition + a single
  `setTimeout` matching the existing repo pattern.
- If `--ease-out` doesn't exist yet and plan 006 hasn't run, use the literal
  `cubic-bezier(0.16,1,0.3,1)` — do not block on plan 006.

## Verification

- **Mechanical**: `node serve.mjs`, load a page with the lead popup, open
  DevTools console — no JS errors when clicking through steps 1 → 2 → 3 and
  back.
- **Feel check**:
  - Open the lead popup, fill step 1, click Next — confirm step 1 fades/slides
    out left while step 2 fades/slides in from the right, not an instant cut.
  - Click Back from step 2 — confirm the reverse also animates (not just
    forward).
  - Rapidly click Next/Back several times in succession — confirm no step
    gets stuck half-transitioned or visually duplicated (two steps briefly
    overlapping is fine; a step stuck at `opacity: 0.5` forever is not).
  - Toggle `prefers-reduced-motion` in DevTools Rendering panel — confirm
    steps still switch (just instantly, no slide/fade).
- **Done when**: step transitions visibly crossfade+slide at 200ms, reduced
  motion still switches steps instantly with no leftover transform, and the
  existing modal open/close animation is unchanged.
