/**
 * Pelion cultural events — data/pelion-cultural-events.json
 * By season (collapsible periods) or A–Z (rail like main directory).
 */
(function () {
  var root = document.getElementById('events-root');
  if (!root) return;

  var LS_SORT = 'kalanera_events_sort';
  var cachedRows = null;
  var railCleanup = null;

  var isEl = document.documentElement.getAttribute('lang') === 'el';

  var S = isEl
    ? {
        when: 'Πότε',
        what: 'Λεπτομέρειες',
        village: 'Χωριό',
        tableCaption: 'Πολιτιστικές εκδηλώσεις Πηλίου',
        tableCaptionAlpha: 'Πολιτιστικές εκδηλώσεις — αλφαβητικά (χωριό)',
        stackAria: 'Εκδηλώσεις ανά περίοδο — ανοίξτε μια ενότητα για λεπτομέρειες',
        stackAriaAlpha: 'Εκδηλώσεις αλφαβητικά — σύρετε στη δεξιά στήλη για γρήγορη μετάβαση',
        desktopPeriodsAria: 'Πίνακας ανά περίοδο — ανοίξτε μια ενότητα για τον πίνακα',
        desktopAlphaAria: 'Πίνακας αλφαβητικά',
        alphaRailAria: 'Γρήγορη μετάβαση ανά γράμμα',
        sourceLead: 'Πηγή:',
        loadErr: 'Δεν ήταν δυνατή η φόρτωση της λίστας εκδηλώσεων. Δοκιμάστε ξανά αργότερα.',
        lastReviewed: 'Τελευταία ενημέρωση σελίδας',
        asideAria: 'Πηγή',
        creditLinkText: 'Around Pelion — Cultural events',
      }
    : {
        when: 'When',
        what: 'What',
        village: 'Village',
        tableCaption: 'Pelion cultural events',
        tableCaptionAlpha: 'Pelion cultural events — A–Z by village',
        stackAria: 'Events by period — open a section for details',
        stackAriaAlpha: 'Events A–Z — use the rail on the right to jump',
        desktopPeriodsAria: 'Table by period — open a section to see rows',
        desktopAlphaAria: 'Table A–Z by village',
        alphaRailAria: 'Jump by letter',
        sourceLead: 'Data source:',
        loadErr: 'Could not load the events list. Please try again later.',
        lastReviewed: 'Page last updated',
        asideAria: 'Source',
        creditLinkText: 'Around Pelion — Cultural events',
      };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
  }

  function pick(r, key) {
    var elKey = key + 'El';
    if (isEl && r[elKey]) return r[elKey];
    return r[key];
  }

  function groupHeading(r) {
    if (isEl && r.groupEl) return r.groupEl;
    return r.group;
  }

  function getSortMode() {
    return localStorage.getItem(LS_SORT) === 'alpha' ? 'alpha' : 'season';
  }

  function setSortMode(mode) {
    localStorage.setItem(LS_SORT, mode === 'alpha' ? 'alpha' : 'season');
    updateSortToggleUi();
    if (cachedRows) render(cachedRows);
  }

  function updateSortToggleUi() {
    var m = getSortMode();
    var s = document.getElementById('events-sort-season');
    var a = document.getElementById('events-sort-alpha');
    if (s) s.setAttribute('aria-selected', m === 'season' ? 'true' : 'false');
    if (a) a.setAttribute('aria-selected', m === 'alpha' ? 'true' : 'false');
  }

  function wireSortToggle() {
    var s = document.getElementById('events-sort-season');
    var a = document.getElementById('events-sort-alpha');
    if (!s || !a || s._evWired) return;
    s._evWired = true;
    s.addEventListener('click', function () {
      setSortMode('season');
    });
    a.addEventListener('click', function () {
      setSortMode('alpha');
    });
    updateSortToggleUi();
  }

  function eventCountLabel(n) {
    if (isEl) return n === 1 ? '1 εκδήλωση' : n + ' εκδηλώσεις';
    return n === 1 ? '1 event' : n + ' events';
  }

  function sortRows(rows, mode) {
    var out = rows.slice();
    if (mode === 'alpha') {
      out.sort(function (a, b) {
        return String(pick(a, 'village')).localeCompare(String(pick(b, 'village')), isEl ? 'el' : 'en', {
          sensitivity: 'base',
        });
      });
    } else {
      out.sort(function (a, b) {
        var d = a.sort - b.sort;
        if (d !== 0) return d;
        return String(pick(a, 'village')).localeCompare(String(pick(b, 'village')), isEl ? 'el' : 'en');
      });
    }
    return out;
  }

  function letterBucket(village) {
    var v = String(village || '').trim();
    if (!v) return '#';
    if (isEl) {
      try {
        var ch = v.codePointAt(0);
        var s0 = String.fromCodePoint(ch);
        return s0.toLocaleUpperCase('el-GR');
      } catch (e) {
        return v.charAt(0).toLocaleUpperCase('el-GR');
      }
    }
    var u = v.charAt(0).toUpperCase();
    return /^[A-Z]$/.test(u) ? u : '#';
  }

  function buildGroups(rows) {
    var groups = [];
    var idx = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var key = r.group;
      if (idx[key] === undefined) {
        idx[key] = groups.length;
        groups.push({ key: key, label: groupHeading(r), rows: [] });
      }
      groups[idx[key]].rows.push(r);
    }
    return groups;
  }

  function teardownEventsAlphaRail() {
    if (typeof railCleanup === 'function') {
      try {
        railCleanup();
      } catch (e) {}
      railCleanup = null;
    }
    var old = document.querySelectorAll('.events-page-alpha-index, .events-page-alpha-toast');
    for (var i = 0; i < old.length; i++) {
      try {
        old[i]._observer && old[i]._observer.disconnect();
      } catch (e2) {}
      old[i].remove();
    }
  }

  function buildEventsAlphaRail() {
    if (getSortMode() !== 'alpha') return;

    var cards = root.querySelectorAll('.flights-stack .events-evt-card');
    if (cards.length < 15) return;

    var letterSet = {};
    var anchors = root.querySelectorAll('[data-events-alpha]');
    for (var ai = 0; ai < anchors.length; ai++) {
      var L = anchors[ai].getAttribute('data-events-alpha');
      if (L) letterSet[L] = true;
    }
    var lettersDynamic = Object.keys(letterSet);
    lettersDynamic.sort(function (a, b) {
      if (a === '#') return -1;
      if (b === '#') return 1;
      return a.localeCompare(b, isEl ? 'el' : 'en', { sensitivity: 'base' });
    });

    var letters;
    if (isEl) {
      letters = lettersDynamic;
    } else {
      letters = ['#'].concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
    }

    var index = document.createElement('div');
    index.className = 'alpha-index events-page-alpha-index';
    if (isEl && lettersDynamic.length > 18) index.classList.add('events-page-alpha-index--compact');
    index.setAttribute('aria-label', S.alphaRailAria);
    index.innerHTML = letters
      .map(function (l) {
        var has = letterSet[l];
        if (isEl && !has) return '';
        var enabled = has;
        return (
          '<button type="button" class="alpha-letter ' +
          (enabled ? '' : 'is-disabled') +
          '" data-letter="' +
          escAttr(l) +
          '" ' +
          (enabled ? '' : 'disabled') +
          '>' +
          esc(l) +
          '</button>'
        );
      })
      .join('');

    var toast = document.createElement('div');
    toast.className = 'alpha-toast events-page-alpha-toast';
    toast.setAttribute('aria-hidden', 'true');
    toast.style.display = 'none';
    document.body.appendChild(toast);
    document.body.appendChild(index);

    var anchor = root;
    if (anchor && 'IntersectionObserver' in window) {
      var obs = new IntersectionObserver(
        function (entries) {
          var entry = entries[0];
          if (entry && entry.isIntersecting) {
            index.classList.add('is-visible');
          } else {
            index.classList.remove('is-visible');
          }
        },
        {
          root: null,
          threshold: 0.01,
          rootMargin: '-120px 0px -35% 0px',
        }
      );
      obs.observe(anchor);
      index._observer = obs;
    } else {
      index.classList.add('is-visible');
    }

    var toastTimer = null;
    function showToast(letter) {
      toast.textContent = letter;
      toast.style.display = 'grid';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toast.style.display = 'none';
      }, 500);
    }

    function pickTarget(letter) {
      var mobile = root.querySelector('.flights-stack .events-evt-card[data-events-alpha="' + letter + '"]');
      var desk = root.querySelector('.events-desktop-alpha tbody tr[data-events-alpha="' + letter + '"]');
      if (window.matchMedia('(max-width:767px)').matches) return mobile || desk;
      return desk || mobile;
    }

    function scrollToLetter(letter) {
      var target = pickTarget(letter);
      if (!target) return;
      showToast(letter);
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    index.addEventListener('click', function (e) {
      var btn = e.target.closest('.alpha-letter');
      if (!btn || btn.disabled) return;
      scrollToLetter(btn.getAttribute('data-letter'));
    });

    var lettersForSwipe = letters.filter(function (l) {
      return isEl ? letterSet[l] : true;
    });
    if (!lettersForSwipe.length) lettersForSwipe = letters.slice();

    function handlePoint(clientY) {
      var rect = index.getBoundingClientRect();
      var y = Math.min(Math.max(clientY - rect.top, 0), rect.height - 1);
      var itemH = rect.height / Math.max(lettersForSwipe.length, 1);
      var idx2 = Math.floor(y / itemH);
      var letter = lettersForSwipe[Math.min(Math.max(idx2, 0), lettersForSwipe.length - 1)];
      if (letter && letterSet[letter]) scrollToLetter(letter);
      else if (letter) showToast(letter);
    }

    var tracking = false;
    index.addEventListener('pointerdown', function (e) {
      tracking = true;
      index.setPointerCapture(e.pointerId);
      handlePoint(e.clientY);
    });
    index.addEventListener('pointermove', function (e) {
      if (tracking) handlePoint(e.clientY);
    });
    index.addEventListener('pointerup', function () {
      tracking = false;
    });
    index.addEventListener('pointercancel', function () {
      tracking = false;
    });

    railCleanup = function () {
      clearTimeout(toastTimer);
    };
  }

  function renderThead() {
    return (
      '<thead><tr>' +
      '<th scope="col">' +
      esc(S.village) +
      '</th>' +
      '<th scope="col">' +
      esc(S.when) +
      '</th>' +
      '<th scope="col">' +
      esc(S.what) +
      '</th>' +
      '</tr></thead>'
    );
  }

  function renderSeasonView(sortedRows, thead) {
    var groups = buildGroups(sortedRows);
    var stackHtml = '';
    var desktopHtml =
      '<div class="events-desktop-periods" role="region" aria-label="' + esc(S.desktopPeriodsAria) + '">';

    for (var gi = 0; gi < groups.length; gi++) {
      var G = groups[gi];
      var n = G.rows.length;
      var summaryInner =
        '<span class="flights-day-heading events-period-summary__title">' +
        esc(G.label) +
        '</span><span class="events-period-summary__meta">' +
        '<span class="events-period-count">' +
        esc(eventCountLabel(n)) +
        '</span>' +
        '<i class="fa-solid fa-chevron-down events-period-chevron" aria-hidden="true"></i></span>';

      stackHtml +=
        '<details class="flights-day-group events-period-details">' +
        '<summary class="events-period-summary">' +
        summaryInner +
        '</summary><div class="events-period-cards">';

      var tableBody = '';
      for (var ri = 0; ri < G.rows.length; ri++) {
        var r = G.rows[ri];
        stackHtml +=
          '<article class="flights-card events-evt-card">' +
          '<p class="flights-card-route">' +
          esc(pick(r, 'village')) +
          '</p>' +
          '<dl class="flights-card-meta events-evt-meta">' +
          '<div class="flights-meta-pair events-evt-meta-pair">' +
          '<div class="flights-meta-bit"><dt>' +
          esc(S.when) +
          '</dt><dd>' +
          esc(pick(r, 'when')) +
          '</dd></div></dl>' +
          '<p class="events-card-details">' +
          esc(pick(r, 'details')) +
          '</p></article>';

        tableBody +=
          '<tr><th scope="row" class="flights-col-day events-col-village">' +
          esc(pick(r, 'village')) +
          '</th><td class="flights-time events-col-when">' +
          esc(pick(r, 'when')) +
          '</td><td class="events-col-details">' +
          esc(pick(r, 'details')) +
          '</td></tr>';
      }

      stackHtml += '</div></details>';

      desktopHtml +=
        '<details class="flights-day-group events-period-details">' +
        '<summary class="events-period-summary">' +
        summaryInner +
        '</summary><div class="flights-table-scroll">' +
        '<table class="flights-schedule-table events-cultural-table">' +
        '<caption>' +
        esc(G.label) +
        '</caption>' +
        thead +
        '<tbody class="flights-day-block">' +
        tableBody +
        '</tbody></table></div></details>';
    }

    desktopHtml += '</div>';
    return {
      stackHtml: stackHtml,
      desktopHtml: desktopHtml,
      desktopAlphaHtml: '',
    };
  }

  function renderAlphaView(sortedRows, thead) {
    var seen = {};
    var stackHtml = '<div class="events-alpha-mobile-inner">';
    var tableBody = '';
    for (var i = 0; i < sortedRows.length; i++) {
      var r = sortedRows[i];
      var vname = pick(r, 'village');
      var L = letterBucket(vname);
      var isFirst = !seen[L];
      if (isFirst) seen[L] = true;
      var anchorAttr = isFirst ? ' data-events-alpha="' + escAttr(L) + '"' : '';
      stackHtml +=
        '<article class="flights-card events-evt-card"' +
        anchorAttr +
        '>' +
        '<p class="flights-card-route">' +
        esc(vname) +
        '</p>' +
        '<dl class="flights-card-meta events-evt-meta">' +
        '<div class="flights-meta-pair events-evt-meta-pair">' +
        '<div class="flights-meta-bit"><dt>' +
        esc(S.when) +
        '</dt><dd>' +
        esc(pick(r, 'when')) +
        '</dd></div></dl>' +
        '<p class="events-card-details">' +
        esc(pick(r, 'details')) +
        '</p></article>';

      tableBody +=
        '<tr' +
        anchorAttr +
        '><th scope="row" class="flights-col-day events-col-village">' +
        esc(vname) +
        '</th><td class="flights-time events-col-when">' +
        esc(pick(r, 'when')) +
        '</td><td class="events-col-details">' +
        esc(pick(r, 'details')) +
        '</td></tr>';
    }
    stackHtml += '</div>';

    var desktopAlphaHtml =
      '<div class="events-desktop-alpha" role="region" aria-label="' +
      esc(S.desktopAlphaAria) +
      '">' +
      '<div class="flights-table-scroll">' +
      '<table class="flights-schedule-table events-cultural-table">' +
      '<caption>' +
      esc(S.tableCaptionAlpha) +
      '</caption>' +
      thead +
      '<tbody class="flights-day-block">' +
      tableBody +
      '</tbody></table></div></div>';

    return {
      stackHtml: stackHtml,
      desktopHtml: '',
      desktopAlphaHtml: desktopAlphaHtml,
    };
  }

  function render(rows) {
    teardownEventsAlphaRail();

    var mode = getSortMode();
    var mainEl = document.querySelector('main.events-page');
    if (mainEl) mainEl.classList.toggle('events-page--alpha', mode === 'alpha');

    var sortedRows = sortRows(rows, mode);
    var thead = renderThead();
    var view = mode === 'season' ? renderSeasonView(sortedRows, thead) : renderAlphaView(sortedRows, thead);

    var stackAria = mode === 'season' ? S.stackAria : S.stackAriaAlpha;

    var today = new Date();
    var iso = today.toISOString().slice(0, 10);
    var display = isEl
      ? today.toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })
      : today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    root.innerHTML =
      '<div class="flights-stack" aria-label="' +
      esc(stackAria) +
      '">' +
      view.stackHtml +
      '</div>' +
      view.desktopHtml +
      view.desktopAlphaHtml +
      '<aside class="flights-afterword events-afterword" aria-label="' +
      esc(S.asideAria) +
      '">' +
      '<p class="events-source-credit">' +
      esc(S.sourceLead) +
      ' <a href="https://www.aroundpelion.com/cultural-events" target="_blank" rel="noopener noreferrer">' +
      esc(S.creditLinkText) +
      '</a>.' +
      '</p>' +
      '<p class="flights-reviewed">' +
      esc(S.lastReviewed) +
      ': <time datetime="' +
      esc(iso) +
      '">' +
      esc(display) +
      '</time></p>' +
      '</aside>';

    if (mode === 'alpha') {
      requestAnimationFrame(function () {
        buildEventsAlphaRail();
      });
    }
  }

  function fail() {
    teardownEventsAlphaRail();
    root.innerHTML = '<div class="sheet-data-placeholder">' + esc(S.loadErr) + '</div>';
  }

  function go() {
    fetch('data/pelion-cultural-events.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (rows) {
        if (!Array.isArray(rows) || rows.length === 0) throw new Error('empty');
        cachedRows = rows;
        render(rows);
      })
      .catch(fail);
  }

  function init() {
    wireSortToggle();
    go();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
