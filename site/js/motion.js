// The website's motion, as the mock-up's (launch-pack/motion.js): type rising out of a mask,
// cards rising as they come into view, the gallery photos uncovered by a slanted edge, the
// plan photos drifting in their cards. GSAP and ScrollTrigger come from the site itself
// (js/vendor/), never another server.
//
// The rules, checked by site/check-browser.js:
//   - it only moves what is already on the page, and every tween removes its inline styles
//     when it has played, so the page ends exactly as site.css draws it;
//   - the page is whole without it (if GSAP fails to load, nothing was ever hidden);
//   - nobody who has asked for reduced motion gets any: GSAP isn't even loaded;
//   - the banner stays still (Ross, 27 Sep 2026: a moving Book now gets missed).
(function () {
  'use strict';
  if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  var me = document.currentScript;
  var base = me ? me.src.replace(/[^/]*$/, '') : 'js/';

  function load(src, done) {
    var s = document.createElement('script');
    s.src = base + src;
    s.onload = done;
    document.head.appendChild(s);
  }

  var EASE = 'power2.out';
  var CLEAR = 'transform,opacity,visibility,clipPath';
  var MASKED = { clipPath: 'inset(0% 0% 100% 0%)', y: 48 };
  var OPEN = { clipPath: 'inset(0% 0% 0% 0%)' };
  // A photo uncovered by a slanted edge sweeping left to right, like the triangles on the walls.
  var FACET_SHUT = { clipPath: 'polygon(0% 0%, 0% 0%, -30% 100%, 0% 100%)' };
  var FACET_OPEN = { clipPath: 'polygon(0% 0%, 130% 0%, 100% 100%, 0% 100%)' };
  var REST = { autoAlpha: 1, x: 0, y: 0 };

  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function start() {
    var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
    if (!gsap || !ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    // Bring a group in as it scrolls into view: whichever way it is reached, scrolled to or
    // jumped past (the "Show on map" link) and scrolled back to.
    function reveal(els, from, opts) {
      if (!els.length) return;
      opts = opts || {};
      var to = { duration: opts.duration || 0.9, ease: opts.ease || EASE, stagger: opts.stagger === undefined ? 0.08 : opts.stagger, overwrite: true, clearProps: CLEAR };
      Object.keys(from).forEach(function (k) { to[k] = opts.to && k in opts.to ? opts.to[k] : REST[k]; });
      gsap.set(els, from);
      var play = function (batch) { gsap.to(batch, to); };
      ScrollTrigger.batch(els, { start: opts.start || 'top 90%', once: true, onEnter: play, onEnterBack: play, onLeave: play });
    }

    reveal(all('.page-head h1'), MASKED, { to: OPEN, duration: 0.9, start: 'top 100%' });
    reveal(all('.statement'), MASKED, { to: OPEN, duration: 1.1 });
    reveal(all('.section-title, .category'), MASKED, { to: OPEN, duration: 1 });
    reveal(all('.intro-cols > *, .intro-close, .today-note'), { y: 28, autoAlpha: 0 }, { stagger: 0.1 });
    reveal(all('.hours-card, .today-card'), { y: 40, autoAlpha: 0 }, { duration: 0.8 });
    reveal(all('.hours tr'), { x: 18, autoAlpha: 0 }, { stagger: 0.05, duration: 0.6, start: 'top 96%' });
    reveal(all('.service, .step, .panel, .prices, .day'), { y: 40, autoAlpha: 0 }, { stagger: 0.07, duration: 0.8, start: 'top 94%' });
    reveal(all('.plan'), { y: 70, autoAlpha: 0 }, { stagger: 0.14, duration: 1.1 });
    reveal(all('.gallery li'), FACET_SHUT, { to: FACET_OPEN, stagger: 0.07, duration: 1, ease: 'power2.inOut', start: 'top 92%' });
    reveal(all('.map, .find'), { y: 50, autoAlpha: 0 }, { duration: 1 });
    reveal(all('.foot-sign'), { y: 60, autoAlpha: 0 }, { duration: 1.1, start: 'top 98%' });

    // The plan photos drift a little inside their cards as the page scrolls.
    all('.plan').forEach(function (card) {
      var photo = card.querySelector('.plan-photo');
      if (!photo) return;
      gsap.fromTo(photo, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    // Opening the phone menu brings its links in one after another.
    var root = document.documentElement;
    new MutationObserver(function () {
      if (!root.classList.contains('menu-open')) return;
      gsap.fromTo(all('#menu li'), { x: -28, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.5, stagger: 0.04, ease: EASE, overwrite: true, clearProps: CLEAR });
    }).observe(root, { attributes: true, attributeFilter: ['class'] });

    // Photos arriving late change the page's height: measure again once everything is in.
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  }

  load('vendor/gsap.min.js', function () { load('vendor/ScrollTrigger.min.js', start); });
}());
