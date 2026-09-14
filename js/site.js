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
      document.documentElement.classList.add('is-intro-ready');
    } else {
      document.body.style.overflow = 'hidden';
      try { sessionStorage.setItem(INTRO_KEY, '1'); } catch(e){}
      var introTimer, introDone = false;
      function finishIntro(){
        if (introDone) return;
        introDone = true;
        clearTimeout(introTimer);
        splash.classList.add('is-hidden');
        // Hero content starts staging in right as the splash pulls back,
        // so the two feel like one continuous reveal instead of a loading
        // screen followed by a separate, disconnected page pop-in.
        document.documentElement.classList.add('is-intro-ready');
        setTimeout(function(){
          splash.classList.add('is-removed');
          document.body.style.overflow = '';
        }, 550);
      }
      // Anyone who clicks/taps or presses a key during the intro skips
      // straight to the site — the animation is a nicety, not a gate.
      splash.addEventListener('click', finishIntro);
      document.addEventListener('keydown', function onIntroKey(e){
        if (introDone) { document.removeEventListener('keydown', onIntroKey); return; }
        finishIntro();
      });
      introTimer = setTimeout(finishIntro, 1300);
    }
  }

  // ---------- Blog page only: character-decode headline ----------
  // Splits the H1 into per-letter spans and cycles each through random
  // characters before settling on the real one, staggered left to right —
  // a "terminal decode" reveal used nowhere else on the site, so the Blog
  // page's opening reads as distinct rather than the same fade-up as
  // every other header. Waits on .is-intro-ready the same way hero-intro
  // does (via MutationObserver, since this file doesn't know whether the
  // splash already ran this session or is still about to).
  var blogDecode = document.querySelector('.blog-decode');
  if (blogDecode && !reduceMotion) {
    var decodeChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var decodeLetters = blogDecode.textContent.split('').map(function(ch){
      var span = document.createElement('span');
      span.className = 'char';
      span.textContent = ch === ' ' ? ' ' : ch;
      return { span: span, final: ch };
    });
    blogDecode.textContent = '';
    decodeLetters.forEach(function(l){ blogDecode.appendChild(l.span); });
    function runDecode(){
      decodeLetters.forEach(function(l, i){
        if (l.final === ' ') { l.span.style.opacity = 1; return; }
        var frame = 0;
        var maxFrames = 6 + Math.floor(Math.random() * 4);
        setTimeout(function(){
          l.span.style.opacity = 1;
          var iv = setInterval(function(){
            frame++;
            if (frame >= maxFrames) {
              clearInterval(iv);
              l.span.textContent = l.final;
            } else {
              l.span.textContent = decodeChars[Math.floor(Math.random() * decodeChars.length)];
            }
          }, 35);
        }, i * 28);
      });
    }
    if (document.documentElement.classList.contains('is-intro-ready')) {
      runDecode();
    } else {
      var decodeObs = new MutationObserver(function(){
        if (document.documentElement.classList.contains('is-intro-ready')) {
          runDecode();
          decodeObs.disconnect();
        }
      });
      decodeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // ---------- News page only: stacked-sticky scroll cards ----------
  // Assigns each row its position in the stack via a CSS custom property
  // rather than hardcoding per-row offsets, so the "How it works"-style
  // stacking effect (see .stack-scroll in site.css) keeps working however
  // many news entries get added later.
  document.querySelectorAll('.stack-scroll .timeline-row').forEach(function(row, i){
    row.style.setProperty('--stack-index', i);
  });

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
  // Also idles with a slow auto-tilt when not being interacted with, so the
  // card doesn't sit dead-static — the idle loop checks is-tilting every
  // frame and yields instantly the moment a real mousemove takes over.
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
        // Oscillate around the CSS resting tilt (rotateX:8deg rotateY:-14deg)
        // so the loop doesn't jump on its first frame.
        var rotateY = -14 + Math.sin(t) * 6;
        var rotateX = 8 + Math.cos(t * 0.8) * 3;
        card.style.transform = 'rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
      }
      // Only run the idle loop while the card is actually on-screen.
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
        idleTilt();
      }
    });
  }

  // ---------- Hero video (deferred: loads/plays only once in view) ----------
  var heroVideo = document.getElementById('heroVideo');
  if (heroVideo) {
    if ('IntersectionObserver' in window) {
      var heroIo = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if (entry.isIntersecting) {
            if (heroVideo.getAttribute('preload') !== 'auto') heroVideo.preload = 'auto';
            var playPromise = heroVideo.play();
            if (playPromise && playPromise.catch) playPromise.catch(function(){});
          } else {
            heroVideo.pause();
          }
        });
      }, { threshold: 0.25 });
      heroIo.observe(heroVideo);
    } else {
      heroVideo.play();
    }
  }

  // ---------- Stat count-up (once per element, on scroll into view) ----------
  if ('IntersectionObserver' in window) {
    var statIo = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (!entry.isIntersecting) return;
        statIo.unobserve(entry.target);
        var el = entry.target;
        var target = parseFloat(el.dataset.target) || 0;
        var suffix = el.dataset.suffix || '';
        if (reduceMotion) { el.textContent = target + suffix; return; }
        var duration = 1400;
        var start = null;
        function step(ts){
          if (!start) start = ts;
          var progress = Math.min((ts - start) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    document.querySelectorAll('.stat-number[data-target]').forEach(function(el){ statIo.observe(el); });
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
    // Keep the closed menu out of the tab order — otherwise a keyboard user
    // tabs through invisible links before ever reaching page content.
    if (open) { menu.removeAttribute('inert'); }
    else { menu.setAttribute('inert', ''); }
  }
  if (menu) menu.setAttribute('inert', '');
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

  // ---------- FAQ accordion + search (only present on faq.html) ----------
  var faqItems = document.querySelectorAll('.faq-item');
  if (faqItems.length) {
    faqItems.forEach(function(item){
      var btn = item.querySelector('.faq-question');
      var answer = item.querySelector('.faq-answer');
      if (!btn || !answer) return;
      btn.addEventListener('click', function(){
        var isOpen = item.classList.contains('is-open');
        item.classList.toggle('is-open', !isOpen);
        btn.setAttribute('aria-expanded', String(!isOpen));
        answer.style.maxHeight = isOpen ? '0px' : answer.scrollHeight + 'px';
      });
    });
    var faqSearch = document.getElementById('faqSearch');
    if (faqSearch) {
      faqSearch.addEventListener('input', function(){
        var q = faqSearch.value.trim().toLowerCase();
        document.querySelectorAll('.faq-category').forEach(function(cat){
          var anyVisible = false;
          cat.querySelectorAll('.faq-item').forEach(function(item){
            var match = !q || item.textContent.toLowerCase().indexOf(q) !== -1;
            item.hidden = !match;
            if (match) anyVisible = true;
          });
          cat.hidden = !anyVisible;
        });
      });
    }
  }

  // ---------- Scroll reveal (progressive enhancement) ----------
  if ('IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
          // A revealed timeline row also advances that timeline's
          // progressively-drawn connector fill — reusing this same
          // observer rather than a separate scroll-linked engine.
          if (entry.target.classList.contains('timeline-row')) {
            var timeline = entry.target.closest('.timeline');
            var fill = timeline && timeline.querySelector('.timeline-fill');
            if (fill) {
              var rows = timeline.querySelectorAll('.timeline-row').length;
              var doneRows = timeline.querySelectorAll('.timeline-row.is-visible').length;
              fill.style.height = (doneRows / rows * 100) + '%';
            }
          }
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
  }

  // ---------- Scroll-driven: header weight, progress bar, parallax ----------
  if (!reduceMotion) {
    var parallaxEls = Array.prototype.slice.call(document.querySelectorAll('.parallax-el'));
    var ticking = false;
    var lastY = window.scrollY || window.pageYOffset;
    function onScroll(){
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function(){
        var y = window.scrollY || window.pageYOffset;
        if (header) {
          header.classList.toggle('is-scrolled', y > 8);
          // Hide on scroll-down, show on scroll-up — only once past the hero
          // so it doesn't flicker on tiny scrolls near the top.
          if (y > lastY + 4 && y > 160) header.classList.add('is-hidden');
          else if (y < lastY - 4 || y <= 160) header.classList.remove('is-hidden');
        }
        lastY = y;
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
    var stepStatus = document.getElementById('leadStepStatus');
    var SESSION_KEY = 'haLeadPopupShown';
    var autoShown = false;
    try { autoShown = sessionStorage.getItem(SESSION_KEY) === '1'; } catch(e){}

    function goToStep(n){
      var target = String(n);
      steps.forEach(function(s){
        if (s.dataset.step === target) {
          s.classList.add('is-active');
          // force layout so the browser registers display:block before
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
      dots.forEach(function(d){
        var active = d.dataset.dot === String(n);
        d.classList.toggle('is-active', active);
        if (active) d.setAttribute('aria-current', 'step');
        else d.removeAttribute('aria-current');
      });
      if (stepStatus) stepStatus.textContent = 'Step ' + n + ' of ' + dots.length;
    }

    // Make every other page element inert while a dialog (lead modal or
    // chat panel) is open, so Tab/Shift+Tab can't reach content hidden
    // behind the scrim. `keep` is the array of elements to leave alone —
    // referencing chatLauncher/chatPanel here is safe even though they're
    // declared further down this same scope: this function is only ever
    // invoked later, after they've been assigned.
    function setBackgroundInert(on, keep){
      Array.prototype.forEach.call(document.body.children, function(el){
        if (keep.indexOf(el) !== -1) return;
        // The mobile menu manages its own inert state independently (see
        // setMenuOpen) based on whether IT is open, not whether a dialog
        // is — restoring the background must never re-enable a closed menu.
        if (menu && el === menu && !menu.classList.contains('is-open')) {
          menu.setAttribute('inert', '');
          return;
        }
        if (on) el.setAttribute('inert', '');
        else el.removeAttribute('inert');
      });
    }

    // Lead form posts here instead of send-lead.php — same off-host move
    // as the chat widget above, and for the same reason (this cPanel
    // server's .htaccess denies every .php file except explicitly
    // whitelisted names).
    var LEAD_API_URL = 'https://ha-health-chat-api.vercel.app/api/lead';

    function openLead(interest){
      if (chatOpen) closeChat();
      // The mobile menu's own CTA opens this modal via a <button>, which
      // the menu's "close on link click" handler never sees (it only binds
      // <a> tags) — without this, the drawer silently reappears open behind
      // the modal once it closes.
      if (menu && menu.classList.contains('is-open')) setMenuOpen(false);
      leadScrim.classList.add('is-open');
      leadModal.classList.add('is-open');
      leadModal.removeAttribute('inert');
      leadModal.setAttribute('aria-hidden', 'false');
      setBackgroundInert(true, [leadScrim, leadModal]);
      if (interest) {
        var interestField = leadModal.querySelector('#leadInterest');
        if (interestField) {
          var matched = Array.prototype.some.call(interestField.options, function(opt){
            if (opt.value === interest || opt.textContent === interest) {
              interestField.value = opt.value || opt.textContent;
              return true;
            }
            return false;
          });
          if (!matched) interestField.selectedIndex = 0;
        }
      }
      document.body.style.overflow = 'hidden';
      autoShown = true;
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch(e){}
      var firstField = leadModal.querySelector('input:not(.lead-honeypot)');
      if (firstField) setTimeout(function(){ firstField.focus(); }, 300);
    }

    function closeLead(){
      leadScrim.classList.remove('is-open');
      leadModal.classList.remove('is-open');
      // Blur first — setting aria-hidden while a descendant (e.g. the close
      // button itself) still has focus is an invalid ARIA state and browsers
      // will warn/block it.
      if (leadModal.contains(document.activeElement)) document.activeElement.blur();
      leadModal.setAttribute('aria-hidden', 'true');
      // Restore the rest of the page first, THEN re-inert the now-closed
      // modal — reversed, the blanket restore would immediately undo the
      // modal's own inert and leave it reachable by keyboard while hidden.
      setBackgroundInert(false, []);
      leadModal.setAttribute('inert', '');
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
      var submitBtn = leadForm.querySelector('button[type="submit"]');
      var errorEl = null;
      function showLeadError(message){
        if (!errorEl) {
          errorEl = document.createElement('p');
          errorEl.className = 'lead-error text-xs text-[var(--accent)] mt-3';
          if (submitBtn && submitBtn.parentNode) submitBtn.parentNode.insertAdjacentElement('afterend', errorEl);
        }
        errorEl.textContent = message;
      }
      function clearLeadError(){
        if (errorEl) errorEl.textContent = '';
      }

      leadForm.addEventListener('submit', function(e){
        e.preventDefault();

        // Guard against implicit submission — the form's only
        // type="submit" button lives in step 2's markup, but pressing
        // Enter in a step-1 text field (name/email/phone) can still fire
        // this submit event in some browsers before the visitor ever
        // reaches step 2. Without this guard that silently sends a lead
        // with a defaulted "interest" and a blank message. Route it
        // through the same validate-and-advance path as the "Continue"
        // button instead of actually submitting.
        var step2 = leadModal.querySelector('.lead-step[data-step="2"]');
        if (step2 && !step2.classList.contains('is-active')) {
          var stepOneName = leadModal.querySelector('#leadName');
          var stepOneEmail = leadModal.querySelector('#leadEmail');
          var stepOnePhone = leadModal.querySelector('#leadPhone');
          if (stepOneName && !stepOneName.reportValidity()) return;
          if (stepOneEmail && !stepOneEmail.reportValidity()) return;
          if (stepOnePhone && !stepOnePhone.reportValidity()) return;
          goToStep(2);
          return;
        }

        var honeypot = leadForm.querySelector('.lead-honeypot');
        if (honeypot && honeypot.value) { goToStep(3); return; } // silently "succeed" for bots, no request sent

        clearLeadError();
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

        var leadFormData = new FormData(leadForm);
        var leadPayload = {};
        leadFormData.forEach(function(value, key){ leadPayload[key] = value; });

        fetch(LEAD_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadPayload)
        }).then(function(res){
          return res.json().catch(function(){ return { success: false }; }).then(function(data){
            return { ok: res.ok, data: data };
          });
        }).then(function(result){
          if (result.ok && result.data && result.data.success) {
            goToStep(3);
          } else {
            showLeadError((result.data && result.data.error) || 'Something went wrong — please call us at (832) 800-4352.');
          }
        }).catch(function(){
          showLeadError('Something went wrong — please call us at (832) 800-4352.');
        }).finally(function(){
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }
        });
      });
    }

    // Trigger 1: any explicit "open lead popup" control (e.g. Schedule a Free Consultation buttons)
    document.querySelectorAll('.js-open-lead').forEach(function(el){
      el.addEventListener('click', function(e){
        e.preventDefault();
        openLead(el.dataset.interest);
      });
    });

    // Trigger 2: exit intent — mouse leaves via the top of the viewport (once per session).
    // Never fires on load; requires an actual upward exit gesture past y<=0.
    // Skipped while the chat panel is open — an ambient popup shouldn't interrupt
    // a visitor mid-conversation with the chat widget (it used to yank the chat
    // closed out from under them; see openLead()'s "if (chatOpen) closeChat()").
    if (!autoShown) {
      document.addEventListener('mouseout', function(e){
        if (autoShown || chatOpen) return;
        if (e.clientY <= 0 && !e.relatedTarget) openLead();
      });
    }

    // Trigger 3: scroll depth past the services section (~2200px), once per session.
    // Same chatOpen guard as Trigger 2 — don't fire while the visitor is chatting.
    if (!autoShown) {
      window.addEventListener('scroll', function onScrollDepth(){
        if (autoShown) { window.removeEventListener('scroll', onScrollDepth); return; }
        if (chatOpen) return;
        if ((window.scrollY || window.pageYOffset) > 2200) {
          window.removeEventListener('scroll', onScrollDepth);
          openLead();
        }
      }, { passive: true });
    }

    // ---------- Conversational chat widget (Gemini-backed) ----------
    // Free text and quick-reply chips both flow through sendToAssistant(),
    // which posts to a Vercel-hosted proxy (CHAT_API_URL) that calls Google's
    // Gemini API so the key never reaches client-side JS. Runs off-host on
    // Vercel rather than as a PHP file on the cPanel server, because that
    // server's own .htaccess denies every .php file by extension except the
    // ones explicitly whitelisted there (chat-assistant.php never was).
    // Only booking intent ("schedule", "book", etc.) is still matched
    // locally, as a deterministic shortcut straight to the lead form rather
    // than a round trip to the model.
    var CHAT_API_URL = 'https://ha-health-chat-api.vercel.app/api/chat';
    var chatTopics = {
      ehr: { label: 'eClinicalWorks / EHR', prompt: 'Tell me about your eClinicalWorks / EHR services.', interest: 'EHR Optimization' },
      rcm: { label: 'Medical Billing & RCM', prompt: 'Tell me about your medical billing and revenue cycle management services.', interest: 'Medical Billing & RCM' },
      telemedicine: { label: 'Telemedicine Integration', prompt: 'Tell me about your telemedicine integration services.', interest: 'Telemedicine Integration' },
      compliance: { label: 'Compliance & Regulatory', prompt: 'Tell me about your compliance and regulatory services.', interest: 'Compliance & Regulatory' },
      it: { label: 'IT Support & Managed Services', prompt: 'Tell me about your IT support and managed services.', interest: 'IT Support & Managed Services' },
      workflow: { label: 'Practice Transformation', prompt: 'Tell me about your practice transformation and workflow services.', interest: 'Practice Transformation' }
    };
    var topicOrder = ['ehr','rcm','telemedicine','compliance','workflow','it'];
    // Whole-word/phrase booking-intent list. Single words are matched on word
    // boundaries (not substring) so e.g. "consultants"/"scheduled" in an
    // ordinary question don't false-positive into the booking shortcut —
    // caught in testing when "other consultants?" matched a bare "consult".
    var bookingWords = ['book','schedule','appointment','consultation','talk to someone','talk to a human','sign me up','call me','get started','set up a call','speak to someone'];
    function isBookingIntent(input){
      return bookingWords.some(function(w){
        return w.indexOf(' ') !== -1 ? input.indexOf(w) !== -1 : new RegExp('\\b' + w + '\\b').test(input);
      });
    }

    var chatLauncher = document.createElement('button');
    chatLauncher.type = 'button';
    chatLauncher.className = 'chatbot-launcher';
    chatLauncher.setAttribute('aria-expanded', 'false');
    chatLauncher.setAttribute('aria-controls', 'chatbotPanel');
    chatLauncher.setAttribute('aria-label', 'Open chat with H&A Healthcare Consulting');
    chatLauncher.innerHTML =
      '<svg class="icon-chat" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
      '<svg class="icon-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    var chatPanel = document.createElement('div');
    chatPanel.className = 'chatbot-panel';
    chatPanel.id = 'chatbotPanel';
    chatPanel.setAttribute('role', 'dialog');
    chatPanel.setAttribute('aria-label', 'Chat with H&A Healthcare Consulting');
    chatPanel.setAttribute('inert', '');
    chatPanel.innerHTML =
      '<div class="chatbot-panel-header">' +
        '<div>' +
          '<div class="chatbot-panel-title">H&amp;A Assistant</div>' +
          '<div class="chatbot-panel-sub">Usually replies instantly</div>' +
        '</div>' +
        '<button type="button" class="chatbot-panel-close" aria-label="Close chat">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="chatbot-body" id="chatbotBody" aria-live="polite"></div>' +
      '<form id="chatbotInputRow" class="chatbot-input-row">' +
        '<input type="text" id="chatbotInput" class="chatbot-input" placeholder="Type a message…" autocomplete="off" maxlength="300" />' +
        '<button type="submit" class="chatbot-send" aria-label="Send message">' +
          '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>' +
        '</button>' +
      '</form>';

    document.body.appendChild(chatLauncher);
    document.body.appendChild(chatPanel);

    var chatBody = chatPanel.querySelector('#chatbotBody');
    var chatInputForm = chatPanel.querySelector('#chatbotInputRow');
    var chatInput = chatPanel.querySelector('#chatbotInput');
    var chatSendBtn = chatPanel.querySelector('.chatbot-send');
    var chatCloseBtn = chatPanel.querySelector('.chatbot-panel-close');
    var lastInterest = null;
    var conversationHistory = [];
    var isWaitingForReply = false;

    function scrollChatToBottom(){
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    function addChatMessage(text, isUser){
      var msg = document.createElement('div');
      msg.className = 'chatbot-msg' + (isUser ? ' is-user' : '');
      msg.textContent = text;
      chatBody.appendChild(msg);
      scrollChatToBottom();
      return msg;
    }

    function addTypingIndicator(){
      var typing = document.createElement('div');
      typing.className = 'chatbot-typing';
      typing.innerHTML = '<span></span><span></span><span></span>';
      chatBody.appendChild(typing);
      scrollChatToBottom();
      return typing;
    }

    // Sends a message to the Gemini-backed proxy and renders the reply.
    // displayText (optional) is what's shown in the user's own chat bubble —
    // used so a quick-reply chip like "Medical Billing & RCM" can send a
    // fuller natural-language prompt to the model while showing the short
    // label as what the visitor "said."
    function sendToAssistant(message, displayText){
      if (isWaitingForReply) return;
      var old = chatBody.querySelector('.chatbot-quick-replies');
      if (old) old.remove();
      addChatMessage(displayText || message, true);
      isWaitingForReply = true;
      chatInput.disabled = true;
      chatSendBtn.disabled = true;
      var typing = addTypingIndicator();

      fetch(CHAT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, history: conversationHistory })
      })
        .then(function(res){
          return res.json().catch(function(){ return null; }).then(function(data){
            return { ok: res.ok, data: data };
          });
        })
        .then(function(result){
          typing.remove();
          isWaitingForReply = false;
          chatInput.disabled = false;
          chatSendBtn.disabled = false;
          chatInput.focus();
          if (!result.ok || !result.data || !result.data.success) {
            var errText = (result.data && result.data.error) ||
              "Sorry, I'm having trouble connecting right now — please call (832) 800-4352 or schedule a free consultation.";
            addChatMessage(errText, false);
            addBookingCta(lastInterest || 'Not sure yet');
            return;
          }
          conversationHistory.push({ role: 'user', text: displayText || message });
          conversationHistory.push({ role: 'model', text: result.data.reply });
          if (conversationHistory.length > 16) conversationHistory = conversationHistory.slice(-16);
          addChatMessage(result.data.reply, false);
          if (/\b(consultation|schedule a call|book a call|get you booked|get started)\b/i.test(result.data.reply)) {
            addBookingCta(lastInterest || 'Not sure yet');
          }
        })
        .catch(function(){
          typing.remove();
          isWaitingForReply = false;
          chatInput.disabled = false;
          chatSendBtn.disabled = false;
          addChatMessage("Sorry, I'm having trouble connecting right now — please call (832) 800-4352 or schedule a free consultation.", false);
          addBookingCta(lastInterest || 'Not sure yet');
        });
    }

    function addQuickReplies(topics){
      var old = chatBody.querySelector('.chatbot-quick-replies');
      if (old) old.remove();
      var wrap = document.createElement('div');
      wrap.className = 'chatbot-quick-replies';
      topics.forEach(function(key){
        var topic = chatTopics[key];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chatbot-option';
        btn.textContent = topic.label;
        btn.addEventListener('click', function(){
          lastInterest = topic.interest;
          sendToAssistant(topic.prompt, topic.label);
        });
        wrap.appendChild(btn);
      });
      chatBody.appendChild(wrap);
      scrollChatToBottom();
    }

    function addBookingCta(interest){
      var old = chatBody.querySelector('.chatbot-cta');
      if (old) old.remove();
      var cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'chatbot-cta btn-primary w-full text-sm font-semibold px-5 py-3 rounded-full shadow-soft';
      cta.textContent = 'Schedule Your Free Consultation';
      cta.addEventListener('click', function(){
        closeChat();
        openLead(interest);
      });
      chatBody.appendChild(cta);
      scrollChatToBottom();
    }

    function handleUserText(raw){
      var text = raw.trim();
      if (!text) return;
      var input = text.toLowerCase();

      // Deterministic local shortcut — booking intent skips the model
      // entirely and goes straight to the real lead form.
      if (isBookingIntent(input)) {
        addChatMessage(text, true);
        setTimeout(function(){
          addChatMessage("Great — let's get that on the calendar. Just need a few details.", false);
          setTimeout(function(){ closeChat(); openLead(lastInterest || 'Not sure yet'); }, 700);
        }, 350);
        return;
      }
      sendToAssistant(text);
    }

    chatInputForm.addEventListener('submit', function(e){
      e.preventDefault();
      if (isWaitingForReply) return;
      var val = chatInput.value;
      chatInput.value = '';
      handleUserText(val);
    });

    var chatOpen = false;
    function openChat(){
      if (leadModal.classList.contains('is-open')) closeLead();
      chatOpen = true;
      chatPanel.classList.add('is-open');
      chatPanel.removeAttribute('inert');
      chatLauncher.classList.add('is-open');
      chatLauncher.setAttribute('aria-expanded', 'true');
      chatLauncher.setAttribute('aria-label', 'Close chat');
      setBackgroundInert(true, [chatLauncher, chatPanel]);
      chatBody.innerHTML = '';
      lastInterest = null;
      conversationHistory = [];
      isWaitingForReply = false;
      chatInput.disabled = false;
      chatSendBtn.disabled = false;
      var greeting = "Hi, I'm the H&A assistant. Ask me anything about eClinicalWorks, billing, or our other services — or pick a topic below.";
      addChatMessage(greeting, false);
      conversationHistory.push({ role: 'model', text: greeting });
      addQuickReplies(topicOrder);
      setTimeout(function(){ chatInput.focus(); }, 300);
    }
    function closeChat(){
      chatOpen = false;
      chatPanel.classList.remove('is-open');
      chatLauncher.classList.remove('is-open');
      chatLauncher.setAttribute('aria-expanded', 'false');
      chatLauncher.setAttribute('aria-label', 'Open chat with H&A Healthcare Consulting');
      // Restore the rest of the page first, THEN re-inert the now-closed
      // panel — see the matching comment in closeLead() for why the order matters.
      setBackgroundInert(false, []);
      chatPanel.setAttribute('inert', '');
    }
    chatLauncher.addEventListener('click', function(){
      if (chatOpen) closeChat(); else openChat();
    });
    chatCloseBtn.addEventListener('click', closeChat);
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && chatOpen) closeChat();
    });

    // Reveal the launcher only once scrolled past the hero — on short/mobile
    // viewports the hero's own last line of text can otherwise sit directly
    // behind the fixed launcher on first load.
    var launcherRevealed = false;
    function updateLauncherReveal(){
      var shouldShow = chatOpen || (window.scrollY || window.pageYOffset) > 400;
      if (shouldShow !== launcherRevealed) {
        launcherRevealed = shouldShow;
        chatLauncher.classList.toggle('is-revealed', shouldShow);
      }
    }
    window.addEventListener('scroll', updateLauncherReveal, { passive: true });
    updateLauncherReveal();
  }
})();
