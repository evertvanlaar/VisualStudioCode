/**
 * Volos airport flights + KTEL shuttle (data/flights-2026.json)
 */
(function () {
  var root = document.getElementById('flights-root');
  if (!root) return;

  var isEl = document.documentElement.getAttribute('lang') === 'el';
  var direction = 'all';
  var cachedData = null;

  var LS_DIR = 'kalanera_flights_direction';

  var WEEKDAYS = isEl
    ? ['', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή']
    : ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  var WEEKDAYS_TABLE = isEl
    ? ['', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ']
    : ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  var S = isEl
    ? {
        hint: '<strong>2026</strong> · Εβδομαδιαία δρομολόγια ανά εποχή.',
        dirAria: 'Εστίαση στο ταξίδι',
        dirAll: 'Όλα',
        dirArriving: 'Άφιξη',
        dirDeparting: 'Αναχώρηση',
        trackArriving: 'Άφιξη',
        trackDeparting: 'Αναχώρηση',
        arrives: 'Άφιξη',
        departs: 'Αναχώρηση',
        season: 'Περίοδος',
        shuttleTitle: 'Λεωφορείο αεροδρομίου (ΚΤΕΛ)',
        busToAirport: 'Βόλος → αεροδρόμιο',
        busFromAirport: 'Αεροδρόμιο → Βόλος',
        busLabelToVolos: 'Προς Βόλο',
        busLabelToAirport: 'Προς αεροδρόμιο',
        busLabelToVolosCompact: 'Βόλος',
        busLabelToAirportCompact: 'Αεροδρόμιο',
        departsCompact: 'Αναχώρηση',
        trackDepartingCompact: 'Αναχώρηση',
        noShuttleBusCompact: 'Όχι ΚΤΕΛ',
        flightArrives: 'Άφιξη πτήσης',
        flightDeparts: 'Αναχώρηση πτήσης',
        noShuttleBus: 'Όχι λεωφορείο ΚΤΕΛ',
        scheduleDisclaimer: 'Ενδεικτικό πρόγραμμα — επιβεβαιώνετε ώρες πτήσεων με την αεροπορική σας και λεωφορείο αεροδρομίου με ΚΤΕΛ Μαγνησίας.',
        tableCaption: 'Πτήσεις αεροδρομίου Βόλου 2026 — ενδεικτικό πρόγραμμα',
        colDay: 'Ημέρα',
        colRoute: 'Αεροπορική & διαδρομή',
        colArrives: 'Άφιξη',
        colDeparts: 'Αναχ.',
        colDepartsTitle: 'Αναχώρηση',
        colBusTo: 'Αεροδρ.',
        colBusFrom: 'Βόλος',
        colBusFromTitle: 'Λεωφορείο ΚΤΕΛ αεροδρομίου προς Βόλο',
        colBusToTitle: 'Λεωφορείο ΚΤΕΛ από Βόλο προς αεροδρόμιο',
        lastReviewed: 'Τελευταία ενημέρωση',
        loadErr: 'Δεν ήταν δυνατή η φόρτωση του προγράμματος πτήσεων.',
        loading: 'Φόρτωση…',
        crosslinkBus: 'Λεωφορείο Καλών Νερών',
        crosslinkBusNote: ' — μετά την άφιξη στον Βόλο',
        crosslinkNumbers: 'Χρήσιμα τηλέφωνα',
        crosslinkNumbersNote: ' — έκτακτη ανάγκη & τοπικές υπηρεσίες',
        asideAria: 'Σχετικά με αυτό το πρόγραμμα',
        stackAria: 'Πτήσεις ανά ημέρα',
      }
    : {
        hint: '<strong>2026</strong> · Weekly routes by season.',
        dirAria: 'Journey focus',
        dirAll: 'All',
        dirArriving: 'Arriving',
        dirDeparting: 'Departing',
        trackArriving: 'Arriving',
        trackDeparting: 'Departing',
        arrives: 'Arrival',
        departs: 'Departure',
        season: 'Season',
        shuttleTitle: 'Airport shuttle (KTEL)',
        busToAirport: 'Volos → airport',
        busFromAirport: 'Airport → Volos',
        busLabelToVolos: 'To Volos',
        busLabelToAirport: 'To Airport',
        flightArrives: 'Flight arrives',
        flightDeparts: 'Flight departs',
        noShuttleBus: 'No KTEL',
        noShuttleBusCompact: 'No KTEL',
        scheduleDisclaimer: 'Indicative timetable — confirm flight times with your airline and airport shuttle times with KTEL Magnesias.',
        tableCaption: 'Flights Volos airport 2026 — indicative charter timetable',
        colDay: 'Day',
        colRoute: 'Airline & route',
        colArrives: 'Arrival',
        colDeparts: 'Departure',
        colBusTo: 'To Airport',
        colBusFrom: 'To Volos',
        colBusFromTitle: 'KTEL airport shuttle to Volos',
        colBusToTitle: 'KTEL shuttle from Volos to airport',
        lastReviewed: 'Last reviewed',
        loadErr: 'Could not load the flight schedule.',
        loading: 'Loading…',
        crosslinkBus: 'Bus (Kala Nera)',
        crosslinkBusNote: ' — after you reach Volos',
        crosslinkNumbers: 'Useful numbers',
        crosslinkNumbersNote: ' — emergency & local services',
        asideAria: 'About this schedule',
        stackAria: 'Flights by weekday',
      };

  var BUS_PAGE = isEl ? 'bus-el.html' : 'bus.html';
  var NUMBERS_PAGE = isEl ? 'useful-numbers-el.html' : 'useful-numbers.html';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pick(f, key) {
    return isEl && f[key + 'El'] ? f[key + 'El'] : f[key + 'En'] || f[key];
  }

  function formatRouteHtml(f) {
    var route = pick(f, 'route');
    var html = esc(route);
    if (f.iata) {
      html += ' <span class="flights-route-iata">' + esc(f.iata) + '</span>';
    }
    return html;
  }

  function trackLabels(compact) {
    if (!compact || !isEl) {
      return {
        arrives: S.arrives,
        departs: S.departs,
        busToVolos: S.busLabelToVolos,
        busToAirport: S.busLabelToAirport,
        noShuttle: S.noShuttleBus,
        trackDeparting: S.trackDeparting,
      };
    }
    return {
      arrives: S.arrives,
      departs: S.departsCompact,
      busToVolos: S.busLabelToVolosCompact,
      busToAirport: S.busLabelToAirportCompact,
      noShuttle: S.noShuttleBusCompact,
      trackDeparting: S.trackDepartingCompact,
    };
  }

  function readStoredDirection() {
    try {
      var v = localStorage.getItem(LS_DIR);
      if (v === 'all' || v === 'arriving' || v === 'departing') return v;
    } catch (e) { /* ignore */ }
    return 'all';
  }

  function storeDirection(v) {
    try { localStorage.setItem(LS_DIR, v); } catch (e) { /* ignore */ }
  }

  function groupByWeekday(flights) {
    var map = {};
    flights.forEach(function (f) {
      if (!map[f.weekday]) map[f.weekday] = [];
      map[f.weekday].push(f);
    });
    return map;
  }

  function renderTimelineStep(ev, isLast) {
    var timeHtml = ev.empty
      ? ''
      : '<span class="flights-timeline-time">' + esc(ev.time) + '</span>';
    var actionHtml = ev.empty
      ? '<span class="flights-timeline-action flights-timeline-action--empty"><i class="fa-solid ' + esc(ev.icon) + '" aria-hidden="true"></i><span class="flights-timeline-action-text">' + esc(ev.emptyText || S.noShuttleBus) + '</span></span>'
      : '<span class="flights-timeline-action"><i class="fa-solid ' + esc(ev.icon) + '" aria-hidden="true"></i><span class="flights-timeline-action-text">' + esc(ev.label) + '</span></span>';
    return (
      '<li class="flights-timeline-step' + (isLast ? ' flights-timeline-step--last' : '') + (ev.empty ? ' flights-timeline-step--empty' : '') + '">' +
      '<span class="flights-timeline-time-col">' + timeHtml + '</span>' +
      '<span class="flights-timeline-rail" aria-hidden="true"><span class="flights-timeline-dot"></span></span>' +
      actionHtml +
      '</li>'
    );
  }

  function renderTimelineTrack(title, events, hideTitle) {
    if (!events.length) return '';
    var steps = events.map(function (ev, i) {
      return renderTimelineStep(ev, i === events.length - 1);
    }).join('');
    var titleHtml = hideTitle
      ? ''
      : '<p class="flights-timeline-track-title">' + esc(title) + '</p>';
    return (
      '<div class="flights-timeline-track' + (hideTitle ? ' flights-timeline-track--solo' : '') + '">' +
      titleHtml +
      '<ol class="flights-timeline">' + steps + '</ol>' +
      '</div>'
    );
  }

  function buildArrivingTrack(f, compact) {
    var L = trackLabels(compact);
    var sh = f.shuttle;
    var events = [
      { time: f.arrives, icon: 'fa-plane-arrival', label: L.arrives },
    ];
    if (sh) {
      events.push({ time: sh.airportToVolos, icon: 'fa-bus', label: L.busToVolos });
    } else {
      events.push({ empty: true, icon: 'fa-bus', label: L.busToVolos, emptyText: L.noShuttle });
    }
    return events;
  }

  function buildDepartingTrack(f, compact) {
    var L = trackLabels(compact);
    var sh = f.shuttle;
    var events = [];
    if (sh) {
      events.push({ time: sh.volosToAirport, icon: 'fa-bus', label: L.busToAirport });
    } else {
      events.push({ empty: true, icon: 'fa-bus', label: L.busToAirport, emptyText: L.noShuttle });
    }
    events.push({ time: f.departs, icon: 'fa-plane-departure', label: L.departs });
    return events;
  }

  function renderJourney(f) {
    var note = pick(f, 'note');
    var noteHtml = note ? ' <span class="flights-note">(' + esc(note) + ')</span>' : '';
    var trackHtml = '';

    if (direction === 'arriving') {
      trackHtml =
        '<div class="flights-timeline-solo">' +
        renderTimelineTrack(S.trackArriving, buildArrivingTrack(f, false), true) +
        '</div>';
    } else if (direction === 'departing') {
      trackHtml =
        '<div class="flights-timeline-solo">' +
        renderTimelineTrack(S.trackDeparting, buildDepartingTrack(f, false), true) +
        '</div>';
    }

    return (
      '<article class="flights-card flights-card--timeline flights-card--journey">' +
      '<p class="flights-card-route">' + formatRouteHtml(f) + noteHtml + '</p>' +
      trackHtml +
      '<p class="flights-card-season-line"><span>' + esc(S.season) + '</span> ' + esc(pick(f, 'season')) + '</p>' +
      '</article>'
    );
  }

  function renderCardAll(f) {
    var note = pick(f, 'note');
    var noteHtml = note ? ' <span class="flights-note">(' + esc(note) + ')</span>' : '';
    var compactEl = isEl;
    var L = trackLabels(compactEl);
    return (
      '<article class="flights-card flights-card--timeline">' +
      '<p class="flights-card-route">' + formatRouteHtml(f) + noteHtml + '</p>' +
      '<div class="flights-timeline-pair">' +
      renderTimelineTrack(S.trackArriving, buildArrivingTrack(f, compactEl)) +
      renderTimelineTrack(L.trackDeparting, buildDepartingTrack(f, compactEl)) +
      '</div>' +
      '<p class="flights-card-season-line"><span>' + esc(S.season) + '</span> ' + esc(pick(f, 'season')) + '</p>' +
      '</article>'
    );
  }

  function renderStack(flights) {
    var byDay = groupByWeekday(flights);
    var html = '<div class="flights-stack" aria-label="' + esc(S.stackAria) + '">';
    for (var d = 1; d <= 7; d++) {
      if (!byDay[d]) continue;
      html += '<section class="flights-day-group"><h2 class="flights-day-heading">' + esc(WEEKDAYS[d]) + '</h2>';
      byDay[d].forEach(function (f) {
        html += direction === 'all' ? renderCardAll(f) : renderJourney(f);
      });
      html += '</section>';
    }
    html += '</div>';
    return html;
  }

  function formatSeasonCell(season) {
    if (!season) return '';
    return '<span class="flights-season-range">' + esc(season) + '</span>';
  }

  function thStack(label, opts) {
    opts = opts || {};
    var iconHtml = opts.icon
      ? '<i class="fa-solid ' + opts.icon + '" aria-hidden="true"></i>'
      : '';
    return (
      '<span class="flights-th-stack">' +
      '<span class="flights-th-stack-icon" aria-hidden="true">' + iconHtml + '</span>' +
      '<span class="flights-th-stack-label">' + esc(label) + '</span>' +
      '</span>'
    );
  }

  function thPlain(label, thClass) {
    return '<th scope="col" class="' + thClass + '">' + thStack(label) + '</th>';
  }

  function thFlight(label, kind, title) {
    var icon = kind === 'arrives' ? 'fa-plane-arrival' : 'fa-plane-departure';
    var titleAttr = title ? ' title="' + esc(title) + '"' : '';
    return '<th scope="col" class="flights-th-time"' + titleAttr + '>' + thStack(label, { icon: icon }) + '</th>';
  }

  function thBus(label, title) {
    return (
      '<th scope="col" class="flights-th-bus" title="' + esc(title) + '">' +
      '<span class="flights-th-stack flights-th-stack--bus">' +
      '<span class="flights-th-stack-icon" aria-hidden="true"><i class="fa-solid fa-bus" aria-hidden="true"></i></span>' +
      '<span class="flights-th-stack-label">' + esc(label) + '</span>' +
      '<span class="flights-th-ktel-line">KTEL</span>' +
      '</span></th>'
    );
  }

  function busCell(sh, leg) {
    if (!sh) {
      return '<span class="flights-bus-empty">' + esc(S.noShuttleBusCompact) + '</span>';
    }
    if (leg === 'to') return '<span class="flights-time">' + esc(sh.volosToAirport) + '</span>';
    return '<span class="flights-time">' + esc(sh.airportToVolos) + '</span>';
  }

  function tableModeClass() {
    if (direction === 'arriving') return 'flights-schedule-table--mode-arriving';
    if (direction === 'departing') return 'flights-schedule-table--mode-departing';
    return 'flights-schedule-table--mode-all';
  }

  function renderTable(flights) {
    var showBusTo = direction !== 'arriving';
    var showBusFrom = direction !== 'departing';
    var showArrives = direction !== 'departing';
    var showDeparts = direction !== 'arriving';

    var html =
      '<div class="flights-table-scroll"><table class="flights-schedule-table flights-schedule-table--shuttle ' + tableModeClass() + '">' +
      '<caption>' + esc(S.tableCaption) + '</caption><thead><tr>' +
      thPlain(S.colDay, 'flights-th-day') +
      thPlain(S.colRoute, 'flights-th-route');

    if (direction === 'all') {
      html += thFlight(S.colArrives, 'arrives');
      html += thBus(S.colBusFrom, S.colBusFromTitle);
      html += thFlight(S.colDeparts, 'departs', S.colDepartsTitle || '');
      html += thBus(S.colBusTo, S.colBusToTitle);
    } else {
      if (showArrives) html += thFlight(S.colArrives, 'arrives');
      if (showBusFrom) html += thBus(S.colBusFrom, S.colBusFromTitle);
      if (showBusTo) html += thBus(S.colBusTo, S.colBusToTitle);
      if (showDeparts) html += thFlight(S.colDeparts, 'departs', S.colDepartsTitle || '');
    }
    html += thPlain(S.season, 'flights-th-season') + '</tr></thead>';

    flights.forEach(function (f) {
      var routeHtml = formatRouteHtml(f);
      var note = pick(f, 'note');
      var noteHtml = note ? ' <span class="flights-note">(' + esc(note) + ')</span>' : '';
      var season = pick(f, 'season');

      html += '<tbody class="flights-day-block"><tr>' +
        '<th scope="row" class="flights-col-day" title="' + esc(WEEKDAYS[f.weekday]) + '">' + esc(WEEKDAYS_TABLE[f.weekday]) + '</th>' +
        '<td class="flights-col-route">' + routeHtml + noteHtml + '</td>';

      if (direction === 'all') {
        html += '<td class="flights-time">' + esc(f.arrives) + '</td>';
        html += '<td class="flights-col-bus">' + busCell(f.shuttle, 'from') + '</td>';
        html += '<td class="flights-time">' + esc(f.departs) + '</td>';
        html += '<td class="flights-col-bus">' + busCell(f.shuttle, 'to') + '</td>';
      } else {
        if (showArrives) html += '<td class="flights-time">' + esc(f.arrives) + '</td>';
        if (showBusFrom) html += '<td class="flights-col-bus">' + busCell(f.shuttle, 'from') + '</td>';
        if (showBusTo) html += '<td class="flights-col-bus">' + busCell(f.shuttle, 'to') + '</td>';
        if (showDeparts) html += '<td class="flights-time">' + esc(f.departs) + '</td>';
      }
      html += '<td class="flights-col-season">' + formatSeasonCell(season) + '</td></tr></tbody>';
    });

    html += '</table></div>';
    return html;
  }

  function renderDirectionSwitch() {
    return (
      '<div class="flights-direction-wrap">' +
      '<div class="view-toggle view-toggle--segment flights-direction-toggle" role="tablist" aria-label="' + esc(S.dirAria) + '">' +
      '<button type="button" class="view-toggle-btn" role="tab" data-dir="all" aria-selected="' + (direction === 'all' ? 'true' : 'false') + '">' + esc(S.dirAll) + '</button>' +
      '<button type="button" class="view-toggle-btn" role="tab" data-dir="arriving" aria-selected="' + (direction === 'arriving' ? 'true' : 'false') + '">' +
      '<i class="fa-solid fa-plane-arrival" aria-hidden="true"></i> ' + esc(S.dirArriving) + '</button>' +
      '<button type="button" class="view-toggle-btn" role="tab" data-dir="departing" aria-selected="' + (direction === 'departing' ? 'true' : 'false') + '">' +
      '<i class="fa-solid fa-plane-departure" aria-hidden="true"></i> ' + esc(S.dirDeparting) + '</button>' +
      '</div></div>'
    );
  }

  function renderAfterword(data) {
    var reviewed = data.lastReviewed || '';
    return (
      '<aside class="flights-afterword" aria-label="' + esc(S.asideAria) + '">' +
      '<p class="flights-schedule-disclaimer">' + esc(S.scheduleDisclaimer) + '</p>' +
      '<p class="flights-reviewed">' + esc(S.lastReviewed) + ': <time datetime="' + esc(reviewed) + '">' + esc(formatReviewDate(reviewed)) + '</time></p>' +
      '<p class="flights-crosslink-bottom"><a href="' + esc(BUS_PAGE) + '"><i class="fa-solid fa-bus" aria-hidden="true"></i> ' + esc(S.crosslinkBus) + '</a>' +
      '<span class="flights-crosslink-note">' + esc(S.crosslinkBusNote) + '</span></p>' +
      '<p class="flights-crosslink-bottom"><a href="' + esc(NUMBERS_PAGE) + '"><i class="fa-solid fa-phone" aria-hidden="true"></i> ' + esc(S.crosslinkNumbers) + '</a>' +
      '<span class="flights-crosslink-note">' + esc(S.crosslinkNumbersNote) + '</span></p>' +
      '</aside>'
    );
  }

  function formatReviewDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso + 'T12:00:00');
      return d.toLocaleDateString(isEl ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return iso;
    }
  }

  function bindDirectionSwitch() {
    root.querySelectorAll('.flights-direction-toggle [data-dir]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = btn.getAttribute('data-dir');
        if (!next || next === direction) return;
        direction = next;
        storeDirection(next);
        paint(cachedData);
      });
    });
  }

  function paint(data) {
    if (!data || !data.flights) return;
    root.innerHTML =
      '<p class="flights-schedule-hint" role="note"><i class="fa-solid fa-calendar-days" aria-hidden="true"></i> <span class="flights-schedule-hint-text">' + S.hint + '</span></p>' +
      renderDirectionSwitch() +
      renderStack(data.flights) +
      renderTable(data.flights) +
      renderAfterword(data);
    bindDirectionSwitch();
  }

  direction = readStoredDirection();

  fetch('data/flights-2026.json', { cache: 'default' })
    .then(function (res) {
      if (!res.ok) throw new Error('fetch');
      return res.json();
    })
    .then(function (data) {
      cachedData = data;
      paint(data);
    })
    .catch(function () {
      root.innerHTML = '<p class="sheet-data-placeholder sheet-data-placeholder--error">' + esc(S.loadErr) + '</p>';
    });
})();
