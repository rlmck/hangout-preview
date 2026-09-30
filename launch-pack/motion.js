/* =====================================================================================
   The Hangout Climbing — motion
   Goes into Google Tag Manager, not into SimplyBook directly: SimplyBook's own Google Tag
   Manager custom feature loads the container on every page of the booking site, and one
   Custom HTML tag in that container runs this file (settings-checklist.md §4b). Paste
   launch-pack/gtm-tag.html, which tools/build-gtm-tag.js makes from this file; do not paste
   this file by hand.

   WHAT IT MAY DO, AND WHAT IT MAY NOT
   It moves things that are already there. It never adds, removes, reorders or restyles an
   element for good: every tween clears the inline styles it set once it has played, and the
   page is complete without it. That matters, because this file will sometimes not run at
   all (an ad blocker that blocks Google Tag Manager, a cookie refusal, a slow network), and
   custom.css alone has to carry the whole design when it doesn't.
   It does not touch the booking steps: they get their short fade from custom.css, and
   anything slower there gets in the way of booking.

   The one thing it adds to the page is GSAP itself (two script tags, from jsDelivr), unless
   GSAP is already on the page, as it is in the mock-up.

   Written as plain ES5 (var, function), which is what Google Tag Manager's Custom HTML tag
   accepts everywhere; tools/build-gtm-tag.js refuses to build from anything newer.
   Everyone who has asked their system for less motion gets none of it.
   ===================================================================================== */
(function () {
  'use strict';

  if (window.hangoutMotion) return;           // the tag fired twice
  window.hangoutMotion = { version: '2026-09-27' };

  var GSAP = 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js';
  var SCROLL_TRIGGER = 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js';

  // Every selector this file uses, in one place. tools/audit-selectors.js checks each one
  // against the live site's captured markup, as it does custom.css.
  var S = {
    main: '#sb_main',
    menu: '#header .nav-wrapper',
    menuLinks: '#header .nav-wrapper .nav li.menu-item',
    content: '#sb_content',
    statement: '#about-us .txt p:first-child',
    aboutRest: '#about-us .txt p',
    hours: '#schedule.section',
    hoursRows: '#schedule .overview tr',
    bandTitles: '#content-view .title-section',
    memberships: '#sb_membership_module .membership-item',
    membershipPhoto: '.preloader .user.img',
    galleryTiles: '#gallery-view .img-list li',
    map: '#sb_map',
    footer: '#footer',
    pageTitles: '.title-main, .title-section',
    reviews: '#sb_reviews_list_items_container .review-item',
    planCards: '#membership-view .membership-item',
    giftCards: '.promotion-list .promotion-item'
  };

  var EASE = 'power2.out';
  var added = false;                          // something new was set up: ScrollTrigger must measure
  var gsap, ScrollTrigger;

  // ---------------------------------------------------------------- loading GSAP

  function load(src, ready, done) {
    if (ready()) { done(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = done;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- helpers

  function all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function visible(el) {
    return !!(el && el.getClientRects().length);
  }

  // Elements this file has already brought in. SimplyBook fills the home page in pieces
  // (the plans and the photos arrive after the page), so the same scene is set up several
  // times; nothing is animated twice.
  var done = typeof WeakSet === 'function' ? new WeakSet() : null;
  function fresh(list) {
    return list.filter(function (el) {
      if (!visible(el)) return false;
      if (done) { if (done.has(el)) return false; done.add(el); }
      else { if (el.hangoutDone) return false; el.hangoutDone = true; }
      return true;
    });
  }

  function forget(el) {
    if (done) done['delete'](el); else el.hangoutDone = false;
  }

  // Scroll-linked tweens and triggers made for the current page, killed when the page changes.
  var live = [];
  function keep(x) { live = live.concat(x); return x; }   // a batch() hands back several

  // Elements set to their starting positions that have not been brought in yet. If the page
  // changes before they are reached, their triggers go, so they are put back as custom.css
  // draws them and forgotten, to be brought in afresh next time. (Without this, leaving the
  // home page halfway down and coming back left the rest of it invisible.)
  var pending = [];
  function clearPage() {
    live.forEach(function (x) { x.kill(); });
    live = [];
    // The footer is on every page, but only the home page lifts its logo. Killing the tween
    // leaves its last value on the footer, which on the next page held the logo 38% down,
    // half cut off by the footer's bottom edge; so it goes back to where custom.css puts it.
    var footer = document.querySelector(S.footer);
    if (footer) footer.style.removeProperty('--hangout-sign');
    if (pending.length) {
      gsap.set(pending, { clearProps: 'transform,opacity,visibility,clipPath' });
      pending.forEach(forget);
      pending = [];
    }
    visit++;
  }

  // True the first time it is asked about an element on each visit to a page.
  var visit = 0;
  function once(el, what) {
    if (!el || el['hangout' + what] === visit) return false;
    el['hangout' + what] = visit;
    return true;
  }

  // Bring a group in as it scrolls into view. `from` is where each element starts; it goes
  // back to how custom.css draws it (`to`, or the resting value of each property), and the
  // inline styles are removed once it gets there.
  var REST = { autoAlpha: 1, opacity: 1, x: 0, y: 0, xPercent: 0, yPercent: 0, scale: 1 };
  var revealed = [];

  function reveal(els, from, opts) {
    els = fresh(els);
    if (!els.length) return;
    opts = opts || {};
    var to = {
      duration: opts.duration || 0.9,
      ease: opts.ease || EASE,
      stagger: opts.stagger === undefined ? 0.08 : opts.stagger,
      overwrite: true,
      clearProps: 'transform,opacity,visibility,clipPath'
    };
    Object.keys(from).forEach(function (k) {
      to[k] = opts.to && k in opts.to ? opts.to[k] : REST[k];
    });
    revealed = revealed.concat(els);
    pending = pending.concat(els);
    gsap.set(els, from);
    // Whichever way it is reached: scrolled to, or jumped past (a link further down the page)
    // and then scrolled back to. Anything the page opens scrolled past is brought in at once.
    var play = function (batch) {
      pending = pending.filter(function (el) { return batch.indexOf(el) < 0; });
      gsap.to(batch, to);
    };
    keep(ScrollTrigger.batch(els, {
      start: opts.start || 'top 90%',
      once: true,
      onEnter: play,
      onEnterBack: play,
      onLeave: play
    }));
    added = true;
  }

  // Type rising out of a mask: the element is clipped to nothing along its foot and grows up.
  var MASKED = { clipPath: 'inset(0% 0% 100% 0%)', y: 48 };
  var OPEN = { clipPath: 'inset(0% 0% 0% 0%)' };

  // A facet: a photo is uncovered by a slanted edge sweeping left to right, cut like the
  // triangles on the walls. Same four points throughout (top left, top right, bottom right,
  // bottom left) so GSAP can move each one; shut, the shape is a sliver outside the photo.
  var FACET_SHUT = { clipPath: 'polygon(0% 0%, 0% 0%, -30% 100%, 0% 100%)' };
  var FACET_OPEN = { clipPath: 'polygon(0% 0%, 130% 0%, 100% 100%, 0% 100%)' };

  // ---------------------------------------------------------------- the home page

  // The banner (the name, Show on map and Book Now) stays still: things that
  // move under the pointer get missed-clicked. See NOTES.md, 27 Sep 2026.

  function home() {
    // The statement, then the rest of the introduction.
    reveal(all(S.statement), MASKED, { to: OPEN, duration: 1.1, start: 'top 90%' });
    reveal(all(S.aboutRest).slice(1), { y: 28, autoAlpha: 0 }, { stagger: 0.1 });

    // Opening hours: the card, then the days one after another.
    reveal(all(S.hours), { y: 40, autoAlpha: 0 }, { duration: 0.8 });
    reveal(all(S.hoursRows), { x: 18, autoAlpha: 0 }, { stagger: 0.05, duration: 0.6, start: 'top 94%' });

    // Section titles on the bands.
    reveal(all(S.bandTitles), MASKED, { to: OPEN, duration: 1 });

    // The plans rise, and their photos drift inside the card as it passes.
    var plans = all(S.memberships);
    reveal(plans, { y: 70, autoAlpha: 0 }, { stagger: 0.14, duration: 1.1 });
    plans.forEach(function (card) {
      var photo = card.querySelector(S.membershipPhoto);
      if (!once(photo, 'Drift')) return;
      added = true;
      keep(gsap.fromTo(photo, { yPercent: -6 }, {
        yPercent: 6,
        ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true }
      }));
    });

    // The photos open like facets, in the order they sit in the grid.
    reveal(all(S.galleryTiles), FACET_SHUT, { to: FACET_OPEN, stagger: 0.07, duration: 1, ease: 'power2.inOut', start: 'top 92%' });

    reveal(all(S.map), { y: 50, autoAlpha: 0 }, { duration: 1 });

    // The logo at the foot of the page settles into place as you reach it.
    var footer = document.querySelector(S.footer);
    if (once(footer, 'Sign')) {
      added = true;
      keep(gsap.fromTo(footer, { '--hangout-sign': '38%' }, {
        '--hangout-sign': '0%',
        ease: 'none',
        scrollTrigger: { trigger: footer, start: 'top bottom', end: 'bottom bottom', scrub: 0.6 }
      }));
    }
  }

  // ---------------------------------------------------------------- the other pages

  function otherPages() {
    // The page's own heading rises in, once.
    var titles = all(S.pageTitles).filter(function (t) { return t.getBoundingClientRect().top < window.innerHeight; });
    reveal(titles.slice(0, 2), MASKED, { to: OPEN, duration: 0.9, start: 'top 100%' });

    reveal(all(S.reviews), { y: 36, autoAlpha: 0 }, { stagger: 0.06, duration: 0.7, start: 'top 94%' });
    reveal(all(S.planCards), { y: 60, autoAlpha: 0 }, { stagger: 0.12, duration: 1 });
    reveal(all(S.giftCards), { y: 40, autoAlpha: 0 }, { stagger: 0.07, duration: 0.8 });
    reveal(all(S.galleryTiles), FACET_SHUT, { to: FACET_OPEN, stagger: 0.07, duration: 1, ease: 'power2.inOut', start: 'top 92%' });
  }

  // ---------------------------------------------------------------- the phone menu

  // Motion that answers a tap: when the phone menu opens (SimplyBook puts .active on it), its
  // links arrive one after another. On wide screens the links sit in the bar; nothing moves.
  function watchMenu() {
    var menu = document.querySelector(S.menu);
    if (!menu) return null;
    var wasOpen = menu.classList.contains('active');
    var watch = new MutationObserver(function () {
      var open = menu.classList.contains('active');
      if (open && !wasOpen && window.innerWidth <= 1024) {
        // In the order they are seen: custom.css moves Home from the end of the list to the top.
        var links = all(S.menuLinks).sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
        gsap.fromTo(links, { x: -28, autoAlpha: 0 }, {
          x: 0, autoAlpha: 1, duration: 0.5, stagger: 0.04, ease: EASE, overwrite: true,
          clearProps: 'transform,opacity,visibility'
        });
      }
      wasOpen = open;
    });
    watch.observe(menu, { attributes: true, attributeFilter: ['class'] });
    return watch;
  }

  // ---------------------------------------------------------------- following the app

  var page = null;

  function scene() {
    var main = document.querySelector(S.main);
    if (!main) return;
    var now = (main.className.match(/page--[\w-]+/) || [''])[0];
    if (now !== page) {
      page = now;
      clearPage();
    }
    // Only the pages that sell; the booking steps and the account pages are left alone (see
    // the top of the file). SimplyBook calls the add-ons and time steps page--paid_attributes.
    if (!/^page--(index|reviews|membership|gift-card|gallery)$/.test(now)) return;
    added = false;
    if (now === 'page--index') home(); else otherPages();
    // Measuring again mid-scroll makes the page hitch, so only when there is something new.
    if (added) ScrollTrigger.refresh();
  }

  var timer = null;
  var ctx = null;
  function soon() {
    clearTimeout(timer);
    timer = setTimeout(function () { if (ctx) ctx.add(scene); }, 80);
  }

  // Printing, or anything else that looks without scrolling, sees the whole page.
  function showAll() {
    gsap.killTweensOf(revealed);
    gsap.set(revealed, { clearProps: 'transform,opacity,visibility,clipPath' });
  }

  function start() {
    gsap = window.gsap;
    ScrollTrigger = window.ScrollTrigger;
    if (!gsap || !ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    // On phones the address bar comes and goes as you scroll, resizing the window each time;
    // re-measuring for that makes the page jump. Real resizes (turning the phone) still count.
    ScrollTrigger.config({ ignoreMobileResize: true });

    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', function (context) {
      ctx = context;
      scene();
      // SimplyBook is one page that redraws itself: it changes #sb_main's page class when you
      // move between pages, and fills #sb_content as its data arrives.
      var main = document.querySelector(S.main);
      var content = document.querySelector(S.content);
      var watch = new MutationObserver(soon);
      if (main) watch.observe(main, { attributes: true, attributeFilter: ['class'] });
      if (content) watch.observe(content, { childList: true, subtree: true });
      window.addEventListener('hashchange', soon);
      window.addEventListener('beforeprint', showAll);
      var menuWatch = watchMenu();

      return function () {
        ctx = null;
        watch.disconnect();
        if (menuWatch) menuWatch.disconnect();
        window.removeEventListener('hashchange', soon);
        window.removeEventListener('beforeprint', showAll);
        clearPage();
      };
    });
  }

  load(GSAP, function () { return !!window.gsap; }, function () {
    load(SCROLL_TRIGGER, function () { return !!window.ScrollTrigger; }, start);
  });
})();
