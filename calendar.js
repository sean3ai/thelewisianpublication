   // GOOGLE CALENDAR API — Monthly Calendar Grid
   // Reads the publication's public calendar and renders it
   // as a monthly grid with events inside each day.

   /* ==========================================================================
   calendar.js - The Lewisian
   Reads the coverage-request Google Sheet through the Google Sheets API (v4)
   and displays ONLY the events whose Status is "Approved".

   Needs on the page:
     <span id="cal-status"></span>
     <div id="events"></div>

   Config: put these in api_config.js (loaded before this file), e.g.
     const API_CONFIG = {
       SHEET_ID: 'your-spreadsheet-id',
       API_KEY: 'your-google-api-key',
       SHEET_NAME: 'Sheet1'
     };
   If api_config.js does not define them, edit the fallbacks below.
   ========================================================================== */

(function () {
  'use strict';

  // ---------- Configuration ------------------------------------------------
  const USER_CFG = (typeof API_CONFIG !== 'undefined' && API_CONFIG) ? API_CONFIG : {};

  const CFG = Object.assign({
    SHEET_ID: '100lWXk_Df4Vr7KNU3GtztPxVGL8BpiquOcKr_gXc-Kg',
    API_KEY: 'AIzaSyDsfbTO-6G1fQut4oEeqfXJD70_B55lKew',
    SHEET_NAME: 'Sheet1',
    APPROVED_LABEL: 'Approved',      // compared case-insensitively
    SHOW_PAST_EVENTS: false,         // true = also list events that already happened
    REFRESH_MINUTES: 5               // 0 = never auto-refresh
  }, USER_CFG);

  // ---------- DOM ----------------------------------------------------------
  const eventsEl = document.getElementById('events');
  const statusEl = document.getElementById('cal-status');

  // ---------- Header mapping ----------------------------------------------
  // Column headers in the sheet are matched by name (not position), so the
  // column order in the sheet does not matter.
    const HEADER_ALIASES = {
      name: ['name', 'yourname', 'requester', 'requestername'],
      email: ['email', 'emailaddress'],
      organization: ['organization', 'organizationordepartmentname', 'department', 'organizationdepartment'],
      event: ['event', 'eventname', 'title'],
      date: ['date', 'eventdate'],
      time: ['time', 'starttime'],
      location: ['location', 'venue'],
      coverage: ['coverage', 'coverageneeded'],
      message: ['message', 'notes', 'anythingelse'],
      status: ['status']
    };

  const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  function buildColumnMap(headerRow) {
    const map = {};
    headerRow.forEach((h, index) => {
      const key = normalize(h);
      for (const field in HEADER_ALIASES) {
        if (map[field] === undefined && HEADER_ALIASES[field].includes(key)) {
          map[field] = index;
        }
      }
    });
    return map;
  }

  // ---------- Value parsing ------------------------------------------------
  // Google Sheets stores dates as serial numbers (days since 1899-12-30).
  function serialToParts(serial) {
    const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000;
    const d = new Date(ms);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }

  // Returns a local Date at midnight, or null if unreadable.
  function parseDate(value) {
    if (value === undefined || value === null || value === '') return null;

    if (typeof value === 'number') {
      const p = serialToParts(value);
      return new Date(p.y, p.m - 1, p.d);
    }

    const str = String(value).trim();

    // 2026-10-05 (what <input type="date"> sends)
    let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

    // 10/5/2026 (month/day/year)
    m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[1] - 1, +m[2]);

    const fallback = new Date(str);
    if (isNaN(fallback)) return null;
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }

  // Returns { label: '2:30 PM', minutes: 870 } or null.
  function parseTime(value) {
    if (value === undefined || value === null || value === '') return null;

    let minutes = null;

    if (typeof value === 'number') {
      // Time cells are a fraction of a day (0.5 = 12:00 PM)
      minutes = Math.round((value % 1) * 24 * 60);
    } else {
      const str = String(value).trim();
      const m = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
      if (!m) return { label: str, minutes: null };
      let h = +m[1];
      const min = +m[2];
      const mer = (m[3] || '').toUpperCase();
      if (mer === 'PM' && h < 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      minutes = h * 60 + min;
    }

    const h24 = Math.floor(minutes / 60) % 24;
    const mm = String(minutes % 60).padStart(2, '0');
    const h12 = h24 % 12 || 12;
    return { label: `${h12}:${mm} ${h24 >= 12 ? 'PM' : 'AM'}`, minutes };
  }

  function parseCoverage(value) {
    if (!value) return [];
    return String(value)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s === 'not-sure' ? 'Not sure yet' : s.charAt(0).toUpperCase() + s.slice(1)));
  }

  const escapeHtml = (s) =>
    String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  // ---------- Fetch --------------------------------------------------------
  async function fetchSheetRows() {
    const range = encodeURIComponent(CFG.SHEET_NAME);
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(CFG.SHEET_ID)}` +
      `/values/${range}` +
      `?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE` +
      `&dateTimeRenderOption=SERIAL_NUMBER&key=${encodeURIComponent(CFG.API_KEY)}`;

    const res = await fetch(url);

    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body && body.error && body.error.message ? body.error.message : '';
      } catch (_) { /* ignore */ }
      const err = new Error(detail || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    return data.values || [];
  }

  // ---------- Transform ----------------------------------------------------
  function rowsToApprovedEvents(rows) {
    if (rows.length < 2) return [];

    const cols = buildColumnMap(rows[0]);

    if (cols.status === undefined || cols.event === undefined || cols.date === undefined) {
      throw new Error('The sheet is missing a Status, Event or Date column header.');
    }

    const get = (row, field) => (cols[field] === undefined ? '' : row[cols[field]]);

    const events = [];

    rows.slice(1).forEach((row) => {
      const status = String(get(row, 'status')).trim().toLowerCase();
      if (status !== CFG.APPROVED_LABEL.toLowerCase()) return;

      const date = parseDate(get(row, 'date'));
      const eventName = String(get(row, 'event')).trim();
      if (!date || !eventName) return; // skip incomplete rows

      const time = parseTime(get(row, 'time'));

      // Only public-safe fields are kept. Name, email and message are never read into the page.
      events.push({
        title: eventName,
        date,
        time,
        location: String(get(row, 'location')).trim(),
        organization: String(get(row, 'organization')).trim(),
        coverage: parseCoverage(get(row, 'coverage'))
      });
    });

    // Sort by date, then by time
    events.sort((a, b) => {
      if (a.date - b.date !== 0) return a.date - b.date;
      const ta = a.time && a.time.minutes !== null ? a.time.minutes : 0;
      const tb = b.time && b.time.minutes !== null ? b.time.minutes : 0;
      return ta - tb;
    });

    if (CFG.SHOW_PAST_EVENTS) return events;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events.filter((e) => e.date >= today);
  }

  // ---------- Render -------------------------------------------------------
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // ------------------------------renders teh events?
  function renderEvent(e) {
    const coverageTags = e.coverage
      .map((c) => `<span class="event-tag">${escapeHtml(c)}</span>`)
      .join('');

    const metaParts = [];
    metaParts.push(WEEKDAYS[e.date.getDay()]);
    if (e.time) metaParts.push(e.time.label);
    if (e.location) metaParts.push(e.location);

    return `
      <article class="story">
        <div class="story-date" aria-hidden="true">
          <span class="story-month">${MONTHS[e.date.getMonth()]}</span>
          <span class="story-day">${e.date.getDate()}</span>
          <span class="story-year">${e.date.getFullYear()}</span>
        </div>
        <div class="story-body">
          <h3 class="story-title">${escapeHtml(e.title)}${coverageTags}</h3>
          <p class="event-meta">${metaParts.map(escapeHtml).join(' &middot; ')}</p>
          ${e.organization ? `<p class="event-org">${escapeHtml(e.organization)}</p>` : ''}
        </div>
      </article>`;
  }
  // function renderEvent(e) {
  //   const coverageTags = e.coverage
  //     .map((c) => `<span class="event-tag">${escapeHtml(c)}</span>`)
  //     .join('');

  //   const metaParts = [];
  //   metaParts.push(WEEKDAYS[e.date.getDay()]);
  //   if (e.time) metaParts.push(e.time.label);
  //   if (e.location) metaParts.push(e.location);

  //   return `
  //     <article class="event-card">
  //       <div class="event-date" aria-hidden="true">
  //         <span class="event-month">${MONTHS[e.date.getMonth()]}</span>
  //         <span class="event-day">${e.date.getDate()}</span>
  //         <span class="event-year">${e.date.getFullYear()}</span>
  //       </div>
  //       <div class="event-body">
  //         <h4 class="event-title">${escapeHtml(e.title)}</h4>
  //         <p class="event-meta">${metaParts.map(escapeHtml).join(' &middot; ')}</p>
  //         ${e.organization ? `<p class="event-org">${escapeHtml(e.organization)}</p>` : ''}
  //         ${coverageTags ? `<div class="event-tags">${coverageTags}</div>` : ''}
  //       </div>
  //     </article>`;
  // }

  function renderEvents(events) {
    if (!events.length) {
      eventsEl.innerHTML = '<p class="events-empty">No events scheduled at this moment.</p>';
      statusEl.textContent = 'No upcoming events';
      return;
    }

    eventsEl.innerHTML = events.map(renderEvent).join('');
    statusEl.textContent = `${events.length} ${CFG.SHOW_PAST_EVENTS ? 'approved' : 'upcoming'} event${events.length === 1 ? '' : 's'}`;
  }

  function renderError(err) {
    console.error('[calendar.js]', err);

    let msg = 'We could not load the calendar right now. Please try again later.';
    if (err && err.status === 403) {
      msg = 'The calendar is not accessible. Check that the sheet is shared as "Anyone with the link can view" and that the API key allows the Google Sheets API.';
    } else if (err && err.status === 404) {
      msg = 'Spreadsheet not found. Check the Sheet ID.';
    } else if (err && err.status === 400) {
      msg = 'Bad request. Check the Sheet ID, sheet (tab) name and API key.';
    } else if (err && err.message && /missing a/i.test(err.message)) {
      msg = err.message;
    }

    eventsEl.innerHTML = `<p class="events-error">${escapeHtml(msg)}</p>`;
    statusEl.textContent = 'Unable to load events';
  }

  // ---------- Init ---------------------------------------------------------
  async function loadCalendar() {
    if (!eventsEl || !statusEl) return;

    if (/PASTE_YOUR/.test(CFG.SHEET_ID + CFG.API_KEY)) {
      renderError(new Error('Set SHEET_ID and API_KEY in api_config.js.'));
      return;
    }

    statusEl.textContent = 'Loading events…';

    try {
      const rows = await fetchSheetRows();
      renderEvents(rowsToApprovedEvents(rows));
    } catch (err) {
      renderError(err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadCalendar();
    if (CFG.REFRESH_MINUTES > 0) {
      setInterval(loadCalendar, CFG.REFRESH_MINUTES * 60 * 1000);
    }
  });
})();