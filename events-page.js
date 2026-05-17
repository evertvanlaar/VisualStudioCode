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
  var periodOpenMode = 'auto';

  var MONTH_GROUP_NUM = {
    March: 3,
    April: 4,
    May: 5,
    June: 6,
    July: 7,
    August: 8,
    September: 9,
  };

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
        resultsLoading: 'Φόρτωση…',
        resultsAlphaTail: 'αλφαβητικά (χωριό)',
        expandAll: 'Ανάπτυξη όλων',
        collapseAll: 'Σύμπτυξη όλων',
        periodNow: 'Τώρα',
        alphaLetterPrefix: 'Γράμμα',
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
        resultsLoading: 'Loading…',
        resultsAlphaTail: 'A–Z by village',
        expandAll: 'Expand all',
        collapseAll: 'Collapse all',
        periodNow: 'Now',
        alphaLetterPrefix: 'Letter',
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

  var MONTHS_EN = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  var MONTH_STRIP_EL = {
    Ιανουάριος: ['του Ιανουαρίου', 'Ιανουαρίου'],
    Φεβρουάριος: ['του Φεβρουαρίου', 'Φεβρουαρίου'],
    Μάρτιος: ['του Μαρτίου', 'Μαρτίου'],
    Απρίλιος: ['του Απριλίου', 'Απριλίου'],
    Μάιος: ['του Μαΐου', 'Μαΐου'],
    Ιούνιος: ['του Ιουνίου', 'Ιουνίου'],
    Ιούλιος: ['του Ιουλίου', 'Ιουλίου'],
    Αύγουστος: ['του Αυγούστου', 'Αυγούστου'],
    Σεπτέμβριος: ['του Σεπτεμβρίου', 'του Σεπτ.', 'Σεπτεμβρίου', 'Σεπτ.'],
    Οκτώβριος: ['του Οκτωβρίου', 'Οκτωβρίου'],
    Νοέμβριος: ['του Νοεμβρίου', 'Νοεμβρίου'],
    Δεκέμβριος: ['του Δεκεμβρίου', 'Δεκεμβρίου'],
  };

  function stripRedundantMonthInParen(lead, inner) {
    var i;
    var lowered = lead.toLowerCase();
    var out = inner;
    for (i = 0; i < MONTHS_EN.length; i++) {
      if (lowered === MONTHS_EN[i].toLowerCase()) {
        out = out.replace(new RegExp('\\s+of\\s+' + MONTHS_EN[i] + '\\s*$', 'i'), '');
        out = out.replace(new RegExp('\\s+' + MONTHS_EN[i] + '\\s*$', 'i'), '');
      }
    }
    if (isEl && MONTH_STRIP_EL[lead]) {
      MONTH_STRIP_EL[lead]
        .slice()
        .sort(function (a, b) {
          return b.length - a.length;
        })
        .forEach(function (suffix) {
          var escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          out = out.replace(new RegExp('\\s+' + escaped + '\\s*$'), '');
        });
    }
    return out.trim();
  }

  /** Drop repeated month inside parentheses when the label already names that month. */
  function formatWhenDisplay(when) {
    if (!when) return when;
    var match = when.match(/^([^(]+)\(([^)]+)\)\s*$/);
    if (!match) return when;
    var lead = match[1].trim();
    var inner = match[2].trim();
    var cleaned = stripRedundantMonthInParen(lead, inner);
    if (!cleaned || cleaned === inner) return when;
    return lead + ' (' + cleaned + ')';
  }

  function groupHeading(r) {
    if (isEl && r.groupEl) return r.groupEl;
    return r.group;
  }

  function getSortMode() {
    return localStorage.getItem(LS_SORT) === 'alpha' ? 'alpha' : 'season';
  }

  function setSortMode(mode) {
    var prev = getSortMode();
    localStorage.setItem(LS_SORT, mode === 'alpha' ? 'alpha' : 'season');
    if (mode === 'season' && prev === 'alpha') periodOpenMode = 'auto';
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

  function syncEventsBulkActions(mode) {
    var bar = document.getElementById('events-bulk-actions');
    if (!bar) return;
    var show = mode === 'season' && cachedRows && cachedRows.length;
    if (show) bar.removeAttribute('hidden');
    else bar.setAttribute('hidden', '');
  }

  function wireBulkActions() {
    if (document._eventsBulkWired) return;
    document._eventsBulkWired = true;
    document.addEventListener('click', function (e) {
      var id = e.target && e.target.id;
      if (id === 'events-expand-all') {
        periodOpenMode = 'all';
        if (cachedRows) render(cachedRows);
      } else if (id === 'events-collapse-all') {
        periodOpenMode = 'none';
        if (cachedRows) render(cachedRows);
      }
    });
  }

  function getCurrentPeriodKey(groups) {
    if (!groups.length) return null;
    var now = new Date();
    var month = now.getMonth() + 1;
    var i;
    for (i = 0; i < groups.length; i++) {
      if (MONTH_GROUP_NUM[groups[i].key] === month) return groups[i].key;
    }
    var todaySort = now.getFullYear() * 10000 + month * 100 + now.getDate();
    var bestKey = groups[0].key;
    var bestDist = Infinity;
    for (i = 0; i < groups.length; i++) {
      var G = groups[i];
      var minS = G.rows[0].sort;
      var maxS = G.rows[0].sort;
      for (var ri = 1; ri < G.rows.length; ri++) {
        if (G.rows[ri].sort < minS) minS = G.rows[ri].sort;
        if (G.rows[ri].sort > maxS) maxS = G.rows[ri].sort;
      }
      if (todaySort >= minS && todaySort <= maxS + 40) return G.key;
      var mid = (minS + maxS) / 2;
      var dist = Math.abs(todaySort - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = G.key;
      }
    }
    return bestKey;
  }

  function periodDetailsOpenAttr(groupKey, currentKey) {
    if (periodOpenMode === 'all') return ' open';
    if (periodOpenMode === 'none') return '';
    if (groupKey === currentKey) return ' open';
    return '';
  }

  function eventCountLabel(n) {
    if (isEl) return n === 1 ? '1 εκδήλωση' : n + ' εκδηλώσεις';
    return n === 1 ? '1 event' : n + ' events';
  }

  function periodCountLabel(n) {
    if (isEl) return n === 1 ? '1 περίοδος' : n + ' περίοδοι';
    return n === 1 ? '1 period' : n + ' periods';
  }

  function eventsCountWord(n) {
    if (isEl) return n === 1 ? 'εκδήλωση' : 'εκδηλώσεις';
    return n === 1 ? 'event' : 'events';
  }

  function syncEventsResultsLine(rows, mode) {
    var line = document.getElementById('events-results-line');
    if (!line) return;
    if (!rows || !rows.length) {
      line.textContent = '';
      return;
    }
    var n = rows.length;
    var tail = mode === 'alpha' ? S.resultsAlphaTail : periodCountLabel(buildGroups(rows).length);
    line.innerHTML =
      '<strong>' +
      n +
      '</strong> ' +
      esc(eventsCountWord(n)) +
      ' · <span class="events-results-tail">' +
      esc(tail) +
      '</span>';
  }

  function alphaDomId(letter) {
    if (letter === '#') return 'events-alpha-hash';
    var slug = String(letter)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u0370-\u03ff-]/g, '');
    return 'events-alpha-' + (slug || 'x');
  }

  function renderAlphaLetterHeading(letter) {
    return (
      '<h3 class="events-alpha-letter" id="' +
      escAttr(alphaDomId(letter)) +
      '" data-events-alpha="' +
      escAttr(letter) +
      '">' +
      esc(letter) +
      '</h3>'
    );
  }

  function renderEventCard(r, anchorAttr) {
    return (
      '<article class="events-evt-card"' +
      (anchorAttr || '') +
      '>' +
      '<div class="events-evt-head">' +
      '<h3 class="events-evt-village">' +
      esc(pick(r, 'village')) +
      '</h3>' +
      '<p class="events-evt-when">' +
      esc(formatWhenDisplay(pick(r, 'when'))) +
      '</p>' +
      '</div>' +
      '<p class="events-evt-details">' +
      esc(pick(r, 'details')) +
      '</p>' +
      '</article>'
    );
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
      return (
        root.querySelector('.flights-stack .events-alpha-letter[data-events-alpha="' + letter + '"]') ||
        root.querySelector('.flights-stack .events-evt-card[data-events-alpha="' + letter + '"]')
      );
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

  function renderSeasonView(sortedRows) {
    var groups = buildGroups(sortedRows);
    var currentKey = getCurrentPeriodKey(groups);
    var listHtml = '';

    for (var gi = 0; gi < groups.length; gi++) {
      var G = groups[gi];
      var n = G.rows.length;
      var isCurrent = G.key === currentKey;
      var openAttr = periodDetailsOpenAttr(G.key, currentKey);
      var nowBadge = isCurrent
        ? '<span class="events-period-now">' + esc(S.periodNow) + '</span>'
        : '';
      var summaryInner =
        '<span class="events-period-summary__title events-period-title">' +
        esc(G.label) +
        nowBadge +
        '</span><span class="events-period-summary__meta">' +
        '<span class="events-period-count">' +
        esc(eventCountLabel(n)) +
        '</span>' +
        '<i class="fa-solid fa-chevron-down events-period-chevron" aria-hidden="true"></i></span>';

      listHtml +=
        '<details class="flights-day-group events-period-details"' +
        (isCurrent ? ' data-period-current="true"' : '') +
        ' data-period-key="' +
        escAttr(G.key) +
        '"' +
        openAttr +
        '>' +
        '<summary class="events-period-summary">' +
        summaryInner +
        '</summary><div class="events-period-cards">';

      for (var ri = 0; ri < G.rows.length; ri++) {
        listHtml += renderEventCard(G.rows[ri]);
      }

      listHtml += '</div></details>';
    }

    return { listHtml: listHtml };
  }

  function renderAlphaView(sortedRows) {
    var seen = {};
    var listHtml = '<div class="events-alpha-mobile-inner">';
    for (var i = 0; i < sortedRows.length; i++) {
      var r = sortedRows[i];
      var vname = pick(r, 'village');
      var L = letterBucket(vname);
      var isFirst = !seen[L];
      if (isFirst) seen[L] = true;
      var anchorAttr = isFirst ? ' data-events-alpha="' + escAttr(L) + '"' : '';
      if (isFirst) listHtml += renderAlphaLetterHeading(L);
      listHtml += renderEventCard(r, anchorAttr);
    }
    listHtml += '</div>';

    return { listHtml: listHtml };
  }

  function render(rows) {
    teardownEventsAlphaRail();

    var mode = getSortMode();
    var mainEl = document.querySelector('main.events-page');
    if (mainEl) mainEl.classList.toggle('events-page--alpha', mode === 'alpha');

    var sortedRows = sortRows(rows, mode);
    var view = mode === 'season' ? renderSeasonView(sortedRows) : renderAlphaView(sortedRows);

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
      view.listHtml +
      '</div>' +
      '<footer class="events-footnote" aria-label="' +
      esc(S.asideAria) +
      '">' +
      '<p class="events-footnote__line">' +
      esc(S.sourceLead) +
      ' <a href="https://www.aroundpelion.com/cultural-events" target="_blank" rel="noopener noreferrer">' +
      esc(S.creditLinkText) +
      '</a><br>' +
      esc(S.lastReviewed) +
      ' <time datetime="' +
      esc(iso) +
      '">' +
      esc(display) +
      '</time></p>' +
      '</footer>';

    syncEventsResultsLine(rows, mode);
    syncEventsBulkActions(mode);

    if (mode === 'alpha') {
      requestAnimationFrame(function () {
        buildEventsAlphaRail();
      });
    }
  }

  function fail() {
    teardownEventsAlphaRail();
    root.innerHTML = '<div class="sheet-data-placeholder">' + esc(S.loadErr) + '</div>';
    syncEventsResultsLine(null, getSortMode());
    syncEventsBulkActions(getSortMode());
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
    wireBulkActions();
    var line = document.getElementById('events-results-line');
    if (line) line.textContent = S.resultsLoading;
    go();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
