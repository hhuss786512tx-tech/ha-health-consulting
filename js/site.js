(function(){
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = document.getElementById('siteHeader');
  var progress = document.getElementById('scrollProgress');

  // ---------- Opening intro splash (once per browser session) ----------
  var splash = document.getElementById('introSplash');
  if (splash) {
    var INTRO_KEY = 'haIntroShown';
    var introShown = false;
    try { introShown = sessionStorage.getItem(INTRO_KEY) === '1'; } catch(e){}
    if (introShown || reduceMotion) {
      splash.classList.add('is-removed');
    } else {
      document.body.style.overflow = 'hidden';
      try { sessionStorage.setItem(INTRO_KEY, '1'); } catch(e){}
      setTimeout(function(){
        splash.classList.add('is-hidden');
        setTimeout(function(){
          splash.classList.add('is-removed');
          document.body.style.overflow = '';
        }, 550);
      }, 1300);
    }
  }

  // ---------- Custom cursor (desktop, fine-pointer only) ----------
  // Replaces the native pointer outright (cursor:none, gated by a class so a
  // JS failure never leaves the visitor with no cursor at all) and tracks the
  // mouse 1:1 — no lag/lerp, since this needs to feel like an actual cursor.
  var ring = document.getElementById('cursorRing');
  if (ring) {
    if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
      document.documentElement.classList.add('custom-cursor-active');
      var ringActive = false;
      document.addEventListener('mousemove', function(e){
        ring.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) translate(-50%,-50%)';
        if (!ringActive) { ringActive = true; ring.classList.add('is-active'); }
      });
      document.addEventListener('mouseleave', function(){ ring.classList.remove('is-active'); });
      document.addEventListener('mouseenter', function(){ if (ringActive) ring.classList.add('is-active'); });
      var hoverSelector = 'a, button, input, textarea, select, [role="button"]';
      document.addEventListener('mouseover', function(e){
        if (e.target.closest && e.target.closest(hoverSelector)) ring.classList.add('is-hover');
      });
      document.addEventListener('mouseout', function(e){
        if (e.target.closest && e.target.closest(hoverSelector)) ring.classList.remove('is-hover');
      });
    } else {
      ring.style.display = 'none';
    }
  }

  // ---------- 3D business card tilt (follows the cursor, fine-pointer only) ----------
  if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    document.querySelectorAll('.biz-card-3d-wrap').forEach(function(wrap){
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
    });
  }

  // ---------- Mobile menu ----------
  var menuBtn = document.getElementById('mobileMenuBtn');
  var menu = document.getElementById('mobileMenu');
  var scrim = document.getElementById('mobileScrim');
  var iconMenu = document.getElementById('iconMenu');
  var iconClose = document.getElementById('iconClose');
  function setMenuOpen(open){
    if (!menu) return;
    menu.classList.toggle('is-open', open);
    scrim.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    iconMenu.classList.toggle('hidden', open);
    iconClose.classList.toggle('hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function(){
      setMenuOpen(!menu.classList.contains('is-open'));
    });
    scrim.addEventListener('click', function(){ setMenuOpen(false); });
    menu.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ setMenuOpen(false); });
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') setMenuOpen(false);
    });
  }

  // ---------- Scroll reveal (progressive enhancement) ----------
  if ('IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
  }

  // ---------- Scroll-driven: header weight, progress bar, parallax ----------
  if (!reduceMotion) {
    var parallaxEls = Array.prototype.slice.call(document.querySelectorAll('.parallax-el'));
    var ticking = false;
    function onScroll(){
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function(){
        var y = window.scrollY || window.pageYOffset;
        if (header) header.classList.toggle('is-scrolled', y > 8);
        if (progress) {
          var doc = document.documentElement;
          var max = (doc.scrollHeight - doc.clientHeight) || 1;
          progress.style.transform = 'scaleX(' + Math.min(y / max, 1) + ')';
        }
        parallaxEls.forEach(function(el){
          var speed = parseFloat(el.dataset.parallax || '0.1');
          var rect = el.getBoundingClientRect();
          if (rect.bottom > -200 && rect.top < window.innerHeight + 200) {
            el.style.setProperty('--parallax-y', (y * speed * -0.15) + 'px');
          }
        });
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else if (header) {
    header.classList.toggle('is-scrolled', (window.scrollY || 0) > 8);
  }

  // ---------- Lead capture popup ----------
  var leadScrim = document.getElementById('leadScrim');
  var leadModal = document.getElementById('leadModal');
  if (leadScrim && leadModal) {
    var leadForm = document.getElementById('leadForm');
    var closeBtn = document.getElementById('leadCloseBtn');
    var doneBtn = document.getElementById('leadDoneBtn');
    var steps = leadModal.querySelectorAll('.lead-step');
    var dots = leadModal.querySelectorAll('.lead-progress-dot');
    var SESSION_KEY = 'haLeadPopupShown';
    var autoShown = false;
    try { autoShown = sessionStorage.getItem(SESSION_KEY) === '1'; } catch(e){}

    function goToStep(n){
      steps.forEach(function(s){ s.classList.toggle('is-active', s.dataset.step === String(n)); });
      dots.forEach(function(d){ d.classList.toggle('is-active', d.dataset.dot === String(n)); });
    }

    function openLead(){
      leadScrim.classList.add('is-open');
      leadModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      autoShown = true;
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch(e){}
      var firstField = leadModal.querySelector('input:not(.lead-honeypot)');
      if (firstField) setTimeout(function(){ firstField.focus(); }, 300);
    }

    function closeLead(){
      leadScrim.classList.remove('is-open');
      leadModal.classList.remove('is-open');
      document.body.style.overflow = menu && menu.classList.contains('is-open') ? 'hidden' : '';
    }

    closeBtn.addEventListener('click', closeLead);
    leadScrim.addEventListener('click', closeLead);
    if (doneBtn) doneBtn.addEventListener('click', function(){
      closeLead();
      setTimeout(function(){ goToStep(1); if (leadForm) leadForm.reset(); }, 300);
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && leadModal.classList.contains('is-open')) closeLead();
    });

    leadModal.querySelectorAll('.lead-next').forEach(function(btn){
      btn.addEventListener('click', function(){
        var name = leadModal.querySelector('#leadName');
        var email = leadModal.querySelector('#leadEmail');
        var phone = leadModal.querySelector('#leadPhone');
        if (name && !name.reportValidity()) return;
        if (email && !email.reportValidity()) return;
        if (phone && !phone.reportValidity()) return;
        goToStep(btn.dataset.next);
      });
    });
    leadModal.querySelectorAll('.lead-back').forEach(function(btn){
      btn.addEventListener('click', function(){ goToStep(btn.dataset.back); });
    });

    if (leadForm) {
      leadForm.addEventListener('submit', function(e){
        e.preventDefault();
        var honeypot = leadForm.querySelector('.lead-honeypot');
        if (honeypot && honeypot.value) { goToStep(3); return; } // silently "succeed" for bots, do nothing real
        // No backend wired up yet — this just confirms receipt client-side.
        goToStep(3);
      });
    }

    // Trigger 1: any explicit "open lead popup" control (e.g. Schedule a Free Consultation buttons)
    document.querySelectorAll('.js-open-lead').forEach(function(el){
      el.addEventListener('click', function(e){
        e.preventDefault();
        openLead();
      });
    });

    // Trigger 2: exit intent — mouse leaves via the top of the viewport (once per session).
    // Never fires on load; requires an actual upward exit gesture past y<=0.
    if (!autoShown) {
      document.addEventListener('mouseout', function(e){
        if (autoShown) return;
        if (e.clientY <= 0 && !e.relatedTarget) openLead();
      });
    }

    // Trigger 3: scroll depth past the services section (~2200px), once per session.
    if (!autoShown) {
      window.addEventListener('scroll', function onScrollDepth(){
        if (autoShown) { window.removeEventListener('scroll', onScrollDepth); return; }
        if ((window.scrollY || window.pageYOffset) > 2200) {
          window.removeEventListener('scroll', onScrollDepth);
          openLead();
        }
      }, { passive: true });
    }
  }
})();
