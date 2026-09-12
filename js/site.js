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
      var introTimer, introDone = false;
      function finishIntro(){
        if (introDone) return;
        introDone = true;
        clearTimeout(introTimer);
        splash.classList.add('is-hidden');
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

        fetch('/send-lead.php', {
          method: 'POST',
          body: new FormData(leadForm)
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

    // ---------- Conversational rule-based chat widget ----------
    // Free-text input is matched against per-topic keyword lists (best-score
    // wins); quick-reply chips still work and route through the same
    // responder, so both interaction styles stay available side by side.
    // Deliberately NOT LLM-backed — zero API key, zero per-message cost,
    // per the original proposal's no-recurring-cost chatbot decision.
    var chatTopics = {
      ehr: {
        keywords: ['ecw','eclinicalworks','ehr','emr','implementation','optimization','go live','golive','go-live','migration','interface','interfacing','radiology','lab'],
        label: 'eClinicalWorks / EHR',
        text: 'We work exclusively inside eClinicalWorks — implementation, go-live support, migrations, and lab/radiology interfacing. No generalist EHR consultants, just a team that knows eCW inside and out.',
        followUp: "Because eCW is the only platform we touch, onboarding is fast and support actually knows your exact setup — no ramp-up time.",
        interest: 'EHR Optimization'
      },
      rcm: {
        keywords: ['billing','rcm','revenue cycle','claims','collections','denial','coding','payer','reimbursement','get paid'],
        label: 'Medical Billing & RCM',
        text: "Our in-house billing team — 150+ specialists — handles claims, coding, denial management, and collections end to end, built around eCW's actual workflow.",
        followUp: "Because our billing team and our eCW implementation team are the same company, changes on one side never get lost in translation to the other.",
        interest: 'Medical Billing & RCM'
      },
      telemedicine: {
        keywords: ['telemedicine','telehealth','virtual visit','video visit','remote care','video call'],
        label: 'Telemedicine Integration',
        text: 'We integrate telemedicine directly into your existing eCW workflow and scheduling, with HIPAA-compliant setup from day one.',
        followUp: "It plugs into the scheduling your staff already uses, so there's no separate system for patients or your front desk to learn.",
        interest: 'Telemedicine Integration'
      },
      compliance: {
        keywords: ['hipaa','hitech','macra','mips','compliance','regulatory','audit','privacy'],
        label: 'Compliance & Regulatory',
        text: 'We help practices navigate HIPAA, HITECH, and MACRA/MIPS requirements with practical, ongoing compliance support — not just a one-time audit.',
        followUp: "We treat this as ongoing, not a checkbox you tick once a year and forget about.",
        interest: 'Compliance & Regulatory'
      },
      it: {
        keywords: ['it support','help desk','infrastructure','managed services','network','server','tech support','it help'],
        label: 'IT Support & Managed Services',
        text: 'We provide remote and onsite IT support for healthcare practices — day-to-day help desk, infrastructure, and ongoing managed services.',
        followUp: "Same team that knows your eCW setup also handles the IT side, so nothing falls in the gap between two vendors.",
        interest: 'IT Support & Managed Services'
      },
      workflow: {
        keywords: ['workflow','efficiency','practice transformation','process','bottleneck'],
        label: 'Practice Transformation',
        text: 'We help practices optimize day-to-day workflow, automate routine tasks, and remove the friction points slowing your team down.',
        followUp: "Usually this starts with an audit of exactly where time is actually going, not guesswork.",
        interest: 'Practice Transformation'
      }
    };
    var topicOrder = ['ehr','rcm','telemedicine','compliance','workflow','it'];

    var companyReply = "H&A Healthcare Consulting is a Houston-based team working exclusively inside eClinicalWorks — over 20 years of healthcare experience, plus an in-house billing team of 150+ specialists. We're also an official partner of Riceland Healthcare, which gives us the scale to support practices nationwide. What would be most useful to know about — eCW, billing, or something else?";
    var pricingReply = "Pricing depends on your practice's size and what you actually need, so I can't give you a number here — the fastest way to get a real one is a quick call with our team. Want me to get that scheduled?";
    var greetingWords = ['hi','hello','hey','good morning','good afternoon','good evening'];
    var bookingWords = ['book','schedule','appointment','consult','consultation','talk to someone','talk to a human','sign me up','call me','get started','set up a call','speak to someone'];
    var thanksWords = ['thanks','thank you','appreciate it','ok cool','sounds good'];

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
        '<div class="chatbot-panel-title">H&amp;A Assistant</div>' +
        '<div class="chatbot-panel-sub">Usually replies instantly</div>' +
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
    var lastInterest = null;

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

    function addQuickReplies(topics, extraLabel, extraHandler){
      var old = chatBody.querySelector('.chatbot-quick-replies');
      if (old) old.remove();
      var wrap = document.createElement('div');
      wrap.className = 'chatbot-quick-replies';
      topics.forEach(function(key){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chatbot-option';
        btn.textContent = chatTopics[key].label;
        btn.addEventListener('click', function(){ handleTopicSelection(key, true); });
        wrap.appendChild(btn);
      });
      if (extraLabel) {
        var extraBtn = document.createElement('button');
        extraBtn.type = 'button';
        extraBtn.className = 'chatbot-option';
        extraBtn.textContent = extraLabel;
        extraBtn.addEventListener('click', extraHandler);
        wrap.appendChild(extraBtn);
      }
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

    function handleTopicSelection(key, viaClick){
      var topic = chatTopics[key];
      if (viaClick) addChatMessage(topic.label, true);
      lastInterest = topic.interest;
      addChatMessage(topic.text, false);
      setTimeout(function(){
        addChatMessage(topic.followUp, false);
        addBookingCta(topic.interest);
        addQuickReplies(topicOrder.filter(function(k){ return k !== key; }).slice(0, 3), 'Something else', function(){
          addChatMessage('Something else', true);
          addChatMessage("No problem — tell me a bit about what you need, or pick a topic below.", false);
          addQuickReplies(topicOrder);
        });
      }, 450);
    }

    function scoreTopic(input, topic){
      var score = 0;
      topic.keywords.forEach(function(kw){ if (input.indexOf(kw) !== -1) score += kw.split(' ').length; });
      return score;
    }

    function handleUserText(raw){
      var text = raw.trim();
      if (!text) return;
      addChatMessage(text, true);
      var input = text.toLowerCase();

      if (bookingWords.some(function(w){ return input.indexOf(w) !== -1; })) {
        setTimeout(function(){
          addChatMessage("Great — let's get that on the calendar. Just need a few details.", false);
          setTimeout(function(){ closeChat(); openLead(lastInterest || 'Not sure yet'); }, 700);
        }, 350);
        return;
      }
      if (greetingWords.some(function(w){ return input.indexOf(w) !== -1; }) && input.length < 20) {
        setTimeout(function(){
          addChatMessage("Hi! What can I help you with — eCW, billing, telemedicine, compliance, IT support, or something else?", false);
          addQuickReplies(topicOrder);
        }, 350);
        return;
      }
      if (thanksWords.some(function(w){ return input.indexOf(w) !== -1; })) {
        setTimeout(function(){ addChatMessage("Anytime — happy to answer anything else, or I can get you booked with the team.", false); }, 350);
        return;
      }
      // Narrow on purpose: a bare "tell me about"/"company"/"years" would swallow
      // topic-specific questions like "tell me about billing" before they ever
      // reach the keyword scorer below — require it to actually be about the
      // company itself, not just contain a common phrase.
      if (/\b(who are you|what do you do|your company|about h ?& ?a|tell me about (the company|your company|h ?& ?a))\b/.test(input)) {
        setTimeout(function(){ addChatMessage(companyReply, false); addQuickReplies(topicOrder); }, 350);
        return;
      }
      if (/\b(price|pricing|cost|how much|rate|fee)\b/.test(input)) {
        setTimeout(function(){ addChatMessage(pricingReply, false); }, 350);
        return;
      }

      var bestKey = null, bestScore = 0;
      topicOrder.forEach(function(key){
        var s = scoreTopic(input, chatTopics[key]);
        if (s > bestScore) { bestScore = s; bestKey = key; }
      });
      if (bestKey) {
        setTimeout(function(){ handleTopicSelection(bestKey, false); }, 350);
      } else {
        setTimeout(function(){
          addChatMessage("I might not have that one exactly — want to ask about eCW, billing, telemedicine, compliance, or IT support? Or I can connect you with someone on the team.", false);
          addQuickReplies(topicOrder.slice(0, 4), 'Talk to the team', function(){
            addChatMessage('Talk to the team', true);
            setTimeout(function(){ closeChat(); openLead(lastInterest || 'Not sure yet'); }, 300);
          });
        }, 350);
      }
    }

    chatInputForm.addEventListener('submit', function(e){
      e.preventDefault();
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
      addChatMessage("Hi, I'm the H&A assistant. Ask me anything about eClinicalWorks, billing, or our other services — or pick a topic below.", false);
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
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && chatOpen) closeChat();
    });
  }
})();
