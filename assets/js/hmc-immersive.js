/* ============================================================
   HMC Unstoppable - Immersive scroll layer
   Lenis (smooth scroll) + GSAP ScrollTrigger (parallax / reveals / pinning)
   ------------------------------------------------------------
   Design notes:
   - This layer ENHANCES the existing site. The lightweight hmc-parallax.js
     (progress bar, kinetic marquee) and the carousels keep working on their own.
   - It is fully disabled when:
       * prefers-reduced-motion is set, OR
       * the page is embedded in an iframe (Webflow), to avoid nested smooth-scroll
         fighting the parent scroll and breaking the auto-height postMessage.
   - All GSAP libs must already be present (loaded via pinned CDN in index.html).
     If a lib is missing the script no-ops gracefully.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var embedded = window.parent !== window;
  var hasLibs = !!(window.gsap && window.ScrollTrigger);

  // Reveal helper used in the non-motion fallback path so content never stays hidden.
  function revealAll() {
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.style.opacity = '';
      el.style.transform = '';
    });
  }

  if (reduce || embedded || !hasLibs) {
    revealAll();
    return;
  }

  document.documentElement.classList.add('hmc-immersive');

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- 1. Lenis smooth scroll, synced to ScrollTrigger ---------- */
  if (window.Lenis) {
    /* Lenis needs its own stylesheet and it was never included.
       Lenis scrolls by calling window.scrollTo on every animation frame. This page
       sets html{scroll-behavior:smooth}, so the browser applied its own smooth
       animation to each of those calls, and each frame superseded the previous one
       before it could finish. The result was that a wheel notch moved the page about
       ten pixels instead of three hundred, and when the wheel stopped the last native
       animation finally ran to the accumulated target and the page lurched. Measured
       on smo.healthmatters.clinic: twenty three of twenty four wheel notches moved the
       page by nothing, while Lenis reported targetScroll 300 and animatedScroll 295.
       These are the rules Lenis ships in lenis.css. Injected here rather than added to
       each site's stylesheet so the next site built from this script cannot omit them,
       and only when Lenis is actually active, so the reduced-motion and iframe paths
       keep native smooth anchor scrolling. */
    var lenisCss = document.createElement('style');
    lenisCss.setAttribute('data-hmc', 'lenis-required');
    lenisCss.textContent =
      'html.lenis,html.lenis body{height:auto}' +
      '.lenis.lenis-smooth{scroll-behavior:auto !important}' +
      '.lenis.lenis-smooth [data-lenis-prevent]{overscroll-behavior:contain}' +
      '.lenis.lenis-stopped{overflow:hidden}';
    document.head.appendChild(lenisCss);

    var lenis = new window.Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      smoothTouch: false // keep native touch scrolling on mobile for performance
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // In-page anchor links should use Lenis so smooth-scroll feels consistent.
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || href === '#' || href.length < 2) return;
      a.addEventListener('click', function (e) {
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: 0, duration: 1.1 });
      });
    });

    window.__hmcLenis = lenis;
  }

  /* ---------- 2. HERO: layered parallax + type drift on scroll ---------- */
  (function heroParallax() {
    var hero = document.getElementById('top');
    if (!hero) return;
    var carousel = hero.querySelector('.hero-carousel');
    var content = hero.querySelector('.hero-content');
    var word = hero.querySelector('[data-hero-word]');
    var brand = hero.querySelector('.hero-brand');

    // Background drifts slower than the page (depth).
    if (carousel) {
      gsap.to(carousel, {
        yPercent: 16,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
      });
    }
    // Oversized wordmark drifts up and fades slightly as you leave the hero.
    if (word) {
      gsap.to(word, {
        yPercent: -22,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
      });
    }
    // Copy + CTAs lift gently and fade so the hero feels like it lifts away.
    if (content) {
      gsap.to(content, {
        y: -60,
        opacity: 0.35,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 30%', scrub: true }
      });
    }
    if (brand) {
      gsap.to(brand, {
        y: -30,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
      });
    }
    // Intro flourish: wordmark scales in from slightly oversized on first paint.
    if (word) {
      gsap.from(word, { scale: 1.08, opacity: 0, duration: 1.2, ease: 'power3.out', delay: 0.1 });
    }
  })();

  /* ---------- 3. Staggered reveals (replaces flat fade-ins) ---------- */
  // Opt content in without touching markup: tag the major typographic + card blocks.
  var revealSelectors = [
    '.mission-eyebrow', '.stories-head', '.case-study-block',
    '.share-head', '.share-portrait', '.submit-block',
    '.resources-head', '.resource-card',
    '.digital-companion-head', '.dc-card',
    '.impact-stat', '.impact-source',
    '.report-inner > div', '.report-cover-wrap',
    '.supporters-head', '.supporter-cell',
    '.facilitator-head', '.attend-banner', '.facilitator-card'
  ];
  revealSelectors.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el) {
      el.setAttribute('data-reveal', '');
    });
  });

  // Batch reveals with a subtle stagger per group for a cohesive premium cadence.
  gsap.utils.toArray('[data-reveal]').forEach(function (el) {
    gsap.set(el, { y: 40, opacity: 0 });
  });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    onEnter: function (batch) {
      gsap.to(batch, {
        y: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
        stagger: 0.08, overwrite: true
      });
    },
    once: true
  });

  /* ---------- 4. Image parallax inside framed media ---------- */
  // Case-study photos and the report cover photo drift within their frames.
  gsap.utils.toArray('.case-study-image img').forEach(function (img) {
    gsap.fromTo(img, { yPercent: -8 }, {
      yPercent: 8, ease: 'none',
      scrollTrigger: { trigger: img.closest('.case-study-block') || img, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
  var reportPhoto = document.querySelector('.report-cover-photo');
  if (reportPhoto) {
    gsap.fromTo(reportPhoto, { backgroundPositionY: '40%' }, {
      backgroundPositionY: '60%', ease: 'none',
      scrollTrigger: { trigger: reportPhoto.closest('.report') || reportPhoto, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  }

  /* ---------- 5. Oversized section titles drift on scroll ---------- */
  // Gives the big italic display type the "kinetic depth" of the reference sites.
  var driftTitles = [
    '.stories-title', '.share-title', '.resources-title',
    '.digital-companion-title', '.report-title', '.supporters-title',
    '.facilitator-title'
  ];
  driftTitles.forEach(function (sel) {
    var el = document.querySelector(sel);
    if (!el) return;
    gsap.fromTo(el, { x: -24 }, {
      x: 24, ease: 'none',
      scrollTrigger: {
        trigger: el.closest('section') || el,
        start: 'top bottom', end: 'bottom top', scrub: true
      }
    });
  });

  /* ---------- 6. Impact metrics: count-up + accent line draw ---------- */
  document.querySelectorAll('.impact-num').forEach(function (el) {
    var raw = (el.textContent || '').trim();
    var m = raw.match(/^(\d+)(%?)$/);
    if (!m) return; // skip non-numeric (e.g. "LACDMH")
    var end = parseInt(m[1], 10);
    var suffix = m[2] || '';
    var obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: function () {
        gsap.to(obj, {
          v: end, duration: 1.4, ease: 'power2.out',
          onUpdate: function () { el.textContent = Math.round(obj.v) + suffix; }
        });
      }
    });
  });

  /* ---------- 7. Live Unstoppable CTA: background depth ---------- */
  var liveBg = document.querySelector('.live-cta-bg');
  if (liveBg) {
    gsap.fromTo(liveBg, { yPercent: -10 }, {
      yPercent: 10, ease: 'none',
      scrollTrigger: { trigger: '.live-cta', start: 'top bottom', end: 'bottom top', scrub: true }
    });
  }

  /* ---------- 7b. Scroll-pinned slide sections (mission + intro-stories) ----------
     The mission and intro-stories sections are full-viewport carousels that
     auto-advance on a 2.5s timer. When the immersive layer is active we replace
     the timer with a scroll-driven pin: the fullscreen section holds in place and
     each scroll step advances one slide, then the page continues (the Anthropic /
     "reveal each part on scroll" pattern). This drives the carousels' OWN exposed
     hooks (window._hmcMission / window._hmcIntroStories: {stop, go}) so we never
     touch their internals or the section's layout — no CSS-sticky, which is what
     broke the mission carousel before. On touch / small screens and when the
     immersive layer is off (iframe / reduced-motion, handled by the early return
     above) the original auto-advance timer is left running untouched. */
  function pinnedSlides(sectionSel, slideSel, api) {
    var section = document.querySelector(sectionSel);
    var n = document.querySelectorAll(slideSel).length;
    // Guard: need the section, 2+ slides, and the carousel's exposed hooks.
    if (!section || n < 2 || !api || typeof api.go !== 'function') return;
    // Desktop/pointer only. Keep native timer-based advance on touch/small screens.
    if (window.matchMedia('(max-width: 820px)').matches) return;
    try {
      if (typeof api.stop === 'function') api.stop(); // stop the auto-advance timer
      // Force the section to fill the viewport so each slide is truly fullscreen.
      // The mission section is otherwise sized to its content (~576px), so its
      // slides never fill the screen the way the intro-stories slides do. Applied
      // inline and only on immersive desktop (this function has already bailed on
      // touch / iframe / reduced-motion), so the mobile + Webflow-embed timer path
      // is untouched and this is fully reversible.
      var vh = window.innerHeight;
      section.style.setProperty('min-height', vh + 'px', 'important');
      section.style.setProperty('height', vh + 'px', 'important');
      var last = -1;
      // Give each slide an equal segment of the pinned scroll and snap to segment
      // CENTERS, so scrolling always settles on a fully on-screen slide and never
      // on the pin's engage/release edge (which let the adjacent section bleed in).
      var centers = [];
      for (var c = 0; c < n; c++) centers.push((c + 0.5) / n);
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: '+=' + Math.round(n * window.innerHeight),
        pin: true,
        pinSpacing: true,
        scrub: true,
        snap: { snapTo: centers, duration: 0.25, ease: 'power1.inOut' },
        onUpdate: function (self) {
          var i = Math.min(n - 1, Math.floor(self.progress * n));
          if (i !== last) { last = i; api.go(i); }
        }
      });
    } catch (e) {
      // Safety: if the pin setup fails, land on the first slide so nothing freezes hidden.
      try { api.go(0); } catch (e2) {}
    }
  }
  pinnedSlides('.mission', '.mission-slide', window._hmcMission);
  pinnedSlides('.intro-stories', '.intro-stories-slide', window._hmcIntroStories);

  /* ---------- 8. Keep ScrollTrigger honest after async layout shifts ---------- */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  // Images loading in (lazy) change document height; refresh once they settle.
  var refreshTimer;
  document.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
    img.addEventListener('load', function () {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(function () { ScrollTrigger.refresh(); }, 200);
    });
  });
})();
