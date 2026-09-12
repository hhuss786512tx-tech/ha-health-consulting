# 005 — Gate the idle 3D-tilt loop to only run while in viewport

- **Status**: DONE
- **Commit**: c7cf05e
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 1 file (js/site.js)

## Problem

The idle auto-tilt animation for `.biz-card-3d-wrap` cards runs an unconditional
`requestAnimationFrame` loop forever from the moment the page loads, with no
check for whether the card is actually visible. Scrolled far off-screen, it's
still computing a sine/cosine transform every frame.

Current code, verbatim:

```js
/* js/site.js:58-87 — current */
if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
  document.querySelectorAll('.biz-card-3d-wrap').forEach(function(wrap, idx){
    var card = wrap.querySelector('.biz-card-3d');
    if (!card) return;
    wrap.addEventListener('mousemove', function(e){
      var rect = wrap.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width;   // 0..1
      var py = (e.clientY - rect.top) / rect.height;   // 0..1
      var rotateY = (px - 0.5) * 26;   // left/right tilt
      var rotateX = (0.5 - py) * 18;   // up/down tilt
      wrap.classList.add('is-tilting');
      card.style.transform = 'rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) scale(1.04)';
    });
    wrap.addEventListener('mouseleave', function(){
      wrap.classList.remove('is-tilting');
      card.style.transform = '';
    });
    var phase = idx * 1.7; // offset each card so multiples don't sync up
    (function idleTilt(){
      requestAnimationFrame(idleTilt);
      if (wrap.classList.contains('is-tilting')) return;
      var t = Date.now() / 1600 + phase;
      // Oscillate around the CSS resting tilt (rotateX:8deg rotateY:-14deg)
      // so the loop doesn't jump on its first frame.
      var rotateY = -14 + Math.sin(t) * 6;
      var rotateX = 8 + Math.cos(t * 0.8) * 3;
      card.style.transform = 'rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
    })();
  });
}
```

## Target

Track visibility with an `IntersectionObserver` per card and only keep the
`requestAnimationFrame` loop alive while the card is on-screen; restart it
when the card scrolls back into view.

```js
/* target */
if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
  document.querySelectorAll('.biz-card-3d-wrap').forEach(function(wrap, idx){
    var card = wrap.querySelector('.biz-card-3d');
    if (!card) return;
    wrap.addEventListener('mousemove', function(e){
      var rect = wrap.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width;   // 0..1
      var py = (e.clientY - rect.top) / rect.height;   // 0..1
      var rotateY = (px - 0.5) * 26;   // left/right tilt
      var rotateX = (0.5 - py) * 18;   // up/down tilt
      wrap.classList.add('is-tilting');
      card.style.transform = 'rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) scale(1.04)';
    });
    wrap.addEventListener('mouseleave', function(){
      wrap.classList.remove('is-tilting');
      card.style.transform = '';
    });
    var phase = idx * 1.7; // offset each card so multiples don't sync up
    var isVisible = false;
    var rafId = null;
    function idleTilt(){
      rafId = requestAnimationFrame(idleTilt);
      if (wrap.classList.contains('is-tilting')) return;
      var t = Date.now() / 1600 + phase;
      var rotateY = -14 + Math.sin(t) * 6;
      var rotateX = 8 + Math.cos(t * 0.8) * 3;
      card.style.transform = 'rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
    }
    if ('IntersectionObserver' in window) {
      var tiltIo = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if (entry.isIntersecting && !isVisible) {
            isVisible = true;
            idleTilt();
          } else if (!entry.isIntersecting && isVisible) {
            isVisible = false;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = null;
          }
        });
      }, { threshold: 0 });
      tiltIo.observe(wrap);
    } else {
      idleTilt(); // no IO support: fall back to the always-on loop
    }
  });
}
```

## Repo conventions to follow

- This file already uses this exact "observe, start/stop work based on
  visibility" pattern for other continuous work — see the hero video
  handling at `js/site.js:92-108`, which calls `.play()`/`.pause()` from an
  `IntersectionObserver` callback the same way this plan starts/stops the
  `requestAnimationFrame` loop.

## Steps

1. In `js/site.js`, locate the `.biz-card-3d-wrap` block (grep for
   `biz-card-3d-wrap` — should be around line 58-87 unless earlier plans in
   this batch shifted it, but this plan only touches `js/site.js` in a
   region no other plan modifies, so it should be stable).
2. Replace the entire block (from `if (window.matchMedia('(pointer: fine)')`
   through its closing `}`) with the Target version above.
3. Note the change from an IIFE (`(function idleTilt(){...})()`) to a named
   function called once explicitly — this is required so the
   IntersectionObserver callback can invoke it on re-entry without
   redeclaring it.

## Boundaries

- Do NOT change the tilt math (the `rotateX`/`rotateY` formulas) — visibility
  gating only.
- Do NOT change the `mousemove`/`mouseleave` hover-tilt behavior — only the
  idle loop gets the visibility gate.
- Do NOT add a new `IntersectionObserver` polyfill — fall back to the
  always-on loop when `'IntersectionObserver' in window` is false, matching
  how this file already handles that fallback elsewhere (e.g. `js/site.js:105-107`).

## Verification

- **Mechanical**: `node serve.mjs`, open a page with a `.biz-card-3d-wrap`
  element (about/team section), open DevTools console — no errors on load
  or scroll.
- **Feel check**:
  - Scroll the business card into view — confirm the idle tilt animation is
    still running (card gently oscillates when not being hovered).
  - Scroll it out of view, then open DevTools Performance panel and record
    ~3 seconds while the card is off-screen — confirm no recurring
    `idleTilt`-attributed work appears in the flame chart.
  - Scroll it back into view — confirm the idle animation resumes smoothly
    (no visible jump or snap on re-entry).
  - Hover the card — confirm the mouse-follow tilt still works exactly as
    before, and the idle loop correctly pauses while `is-tilting` is set.
- **Done when**: the idle animation only consumes `requestAnimationFrame`
  cycles while the card is intersecting the viewport, resumes cleanly on
  scroll-back, and hover-tilt behavior is unchanged.
