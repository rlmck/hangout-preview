// The website's main script (motion.js only moves things). Everything it touches is already on
// the page without it:
//   - the phone menu opens and closes (without the script the menu is simply always shown);
//   - "open now" / "opens at" for today, in the gym's time zone, allowing for any notice that
//     closes the gym or cancels a session (without it, the week's times are still on the page);
//   - today is marked in the opening hours and the timetable;
//   - notices whose last day has passed are hidden, so a page built days ago is still right.
(function () {
  'use strict';
  var root = document.documentElement;       // the head has already marked it .js, so the
                                              // phone menu starts shut without a flash

  // --- menu ---------------------------------------------------------------------------------
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('menu');
  function setMenu(open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    root.classList.toggle('menu-open', open);
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
    });
  }

  // --- today ----------------------------------------------------------------------------------
  var src = document.getElementById('hangout-data');
  if (!src || !window.Intl) return;
  var data = JSON.parse(src.textContent);
  var WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function londonNow() {
    var parts = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    return { date: parts.year + '-' + parts.month + '-' + parts.day, min: (+parts.hour % 24) * 60 + +parts.minute };
  }
  // Dates are handled as YYYY-MM-DD strings, read at midday UTC so no clock change tips a day over.
  function addDays(iso, n) {
    var d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function dayOf(iso) { return WEEK[new Date(iso + 'T12:00:00Z').getUTCDay()]; }
  function mins(t) { return +t.slice(0, 2) * 60 + +t.slice(3); }

  // The sessions running on a date, and those a notice has cancelled.
  function sessionsOn(iso) {
    var closed = false, cancelled = {};
    data.notices.forEach(function (n) {
      if (n.from <= iso && iso <= n.until) {
        if (n.closed) closed = true;
        n.cancelled.forEach(function (t) { cancelled[t] = true; });
      }
    });
    var all = data.week[dayOf(iso)] || [];
    return {
      running: closed ? [] : all.filter(function (s) { return !cancelled[s.start]; }),
      cancelled: closed ? all : all.filter(function (s) { return cancelled[s.start]; }),
      closed: closed
    };
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var now = londonNow();
  var today = sessionsOn(now.date);
  var left = today.running.filter(function (s) { return mins(s.end) > now.min; });
  var inSession = left.filter(function (s) { return mins(s.start) <= now.min; })[0];
  var lastEnd = today.running.length ? today.running[today.running.length - 1].end : null;

  var status;
  if (inSession) status = '<strong>Open now</strong> until ' + lastEnd;
  else if (left.length && left[0] === today.running[0]) status = '<strong>Open today</strong> from ' + left[0].start;
  else if (left.length) status = '<strong>Next session</strong> today at ' + left[0].start;
  else {
    var next = null;
    for (var i = 1; i <= 14 && !next; i++) {
      var iso = addDays(now.date, i), on = sessionsOn(iso).running;
      if (on.length) next = (i === 1 ? 'tomorrow' : dayOf(iso)) + ' at ' + on[0].start;
    }
    var shut = today.closed || !(data.week[dayOf(now.date)] || []).length;
    status = '<strong>' + (shut ? 'Closed today' : 'Closed for today') + '</strong>' + (next ? '. Next session ' + next : '');
  }

  var html = '<p class="today-status">' + status + '</p>';
  if (left.length) {
    html += '<ul class="today-list">' + left.map(function (s) {
      return '<li><span class="t">' + s.start + '–' + s.end + '</span> <span class="n">' + esc(s.name) +
        '</span> <a href="' + esc(s.book) + '">Book<span class="visually-hidden"> ' + esc(s.name.toLowerCase()) + ' at ' + s.start + '</span></a></li>';
    }).join('') + '</ul>';
  }
  var gone = today.closed ? [] : today.cancelled;
  if (gone.length) {
    html += '<p class="today-cancelled">Cancelled today: ' + gone.map(function (s) { return s.start + ' ' + esc(s.name.toLowerCase()); }).join(', ') + '.</p>';
  }

  // The timetable's today card gets the lot; the opening-hours cards just the one line.
  Array.prototype.forEach.call(document.querySelectorAll('[data-today]'), function (box) {
    var more = box.querySelector('.today-more');
    box.innerHTML = html + (more ? more.outerHTML : '');
    box.classList.add(inSession || left.length ? 'is-open' : 'is-closed');
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-today-status]'), function (line) {
    line.innerHTML = status;
  });

  var dayName = dayOf(now.date);
  Array.prototype.forEach.call(document.querySelectorAll('[data-day="' + dayName + '"]'), function (el) {
    el.classList.add('is-today');
    el.setAttribute('aria-current', 'date');
    Array.prototype.forEach.call(el.querySelectorAll('[data-start]'), function (li) {
      var off = today.cancelled.some(function (s) { return s.start === li.getAttribute('data-start'); });
      if (off) {
        li.classList.add('is-cancelled');
        var n = li.querySelector('.n');
        if (n) n.insertAdjacentHTML('beforeend', ' <em>cancelled today</em>');
      }
    });
  });

  // Notices whose last day has passed.
  Array.prototype.forEach.call(document.querySelectorAll('.notice[data-until]'), function (n) {
    if (n.getAttribute('data-until') < now.date) n.hidden = true;
  });
  var box = document.querySelector('.notices');
  if (box && !box.querySelector('.notice:not([hidden])')) box.hidden = true;
}());
