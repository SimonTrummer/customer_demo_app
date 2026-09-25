/*!
 * Preview Portal — app logic (no backend required)
 *
 * Flow:  ?p=<project-id>  →  passcode  →  secret folder  →  viewer
 * The secret folder name is derived from project id + passcode (see core.js),
 * so a wrong passcode simply points to a folder that doesn't exist.
 */
(function () {
  'use strict';

  var CFG = window.PORTAL_CONFIG || {};
  var Core = window.PreviewCore;

  /* ────────────────────────────────────────────────────────────────────
     Texts. Override any of them in config.js → texts: { de: {...}, en: {...} }
     ──────────────────────────────────────────────────────────────────── */
  var TEXTS = {
    en: {
      docTitle: 'Private Preview',
      secure: 'Private & secure',
      eyebrow: 'Private preview',
      title: 'Your new website<br><em>is ready.</em>',
      titleRoot: 'Your website,<br><em>before anyone else.</em>',
      lead: 'Enter the passcode you received to open your personal preview. Everything here was prepared exclusively for you.',
      leadRoot: 'Enter your project ID and passcode to open your personal website preview.',
      project: 'Project',
      projectId: 'Project ID',
      projectIdPlaceholder: 'e.g. cafe-alma',
      passcode: 'Passcode',
      passcodePlaceholder: 'XXXX-XXXX',
      remember: 'Remember this device for {days} days',
      submit: 'Open preview',
      checking: 'Checking…',
      unlocked: 'Unlocked',
      errorCode: 'That passcode doesn’t match. Please check it and try again.',
      errorProject: 'Please enter your project ID.',
      errorEmpty: 'Please enter your passcode.',
      errorNetwork: 'The server could not be reached. Please check your connection and try again.',
      errorFile: 'This page only works through a web server – see the note below.',
      errorWait: 'Too many attempts. Please wait {s} seconds.',
      help: 'No passcode yet?',
      helpLink: 'Contact {name}',
      helpSubject: 'Access to my website preview ({project})',
      footerNote: 'Confidential preview – please don’t share this link.',
      fileNotice: 'You opened this file directly from your computer. The passcode check needs a web server – upload the portal (or start a local server, see README) and open it via http(s).',
      accessGranted: 'Access granted',
      welcome: 'Welcome, {name}',
      welcomeBack: 'Welcome back, {name}',
      welcomeGeneric: 'Welcome',
      welcomeBackGeneric: 'Welcome back',
      desktop: 'Desktop',
      tablet: 'Tablet',
      mobile: 'Mobile',
      rotate: 'Rotate',
      reload: 'Reload',
      back: 'Back',
      forward: 'Forward',
      openNewTab: 'Open in new tab',
      projectInfo: 'Project info',
      feedback: 'Feedback',
      lock: 'Lock preview',
      locked: 'Preview locked',
      qrTitle: 'Open on your phone',
      qrText: 'Scan this code with your phone’s camera to open the preview on your own device – no passcode needed.',
      copyLink: 'Copy link',
      copied: 'Link copied',
      copyFailed: 'Copying failed',
      loading: 'Loading preview…',
      externalPage: 'External page',
      pages: 'Pages',
      close: 'Close',
      readMore: 'Read more',
      infoTitle: 'About this preview',
      updated: 'Updated {date}',
      noteFrom: 'Note from {name}',
      whatsNew: 'What’s new',
      contactTitle: 'Questions? Get in touch',
      email: 'Email',
      call: 'Call',
      whatsapp: 'WhatsApp',
      website: 'Website',
      giveFeedback: 'Give feedback',
      confidential: 'This preview is confidential and not yet public. Please don’t forward the link.',
      language: 'Language',
      feedbackTitle: 'Share your feedback',
      feedbackLead: 'What do you like? What should change? Your message goes directly to {name}.',
      feedbackPlaceholder: 'e.g. “Could the logo on the start page be a bit bigger?”',
      sendEmail: 'Send by email',
      send: 'Send feedback',
      sending: 'Sending…',
      sent: 'Thank you! Your feedback has been sent.',
      sendError: 'Sending failed. Please try again or use email.',
      feedbackEmpty: 'Please write a short message first.',
      mailSubject: 'Feedback: {title}',
      mailProject: 'Project',
      mailPage: 'Page',
      mailDevice: 'Device',
      waHello: 'Hi {name}, about the preview of “{title}”: '
    },
    de: {
      docTitle: 'Private Vorschau',
      secure: 'Privat & geschützt',
      eyebrow: 'Private Vorschau',
      title: 'Ihre neue Website<br><em>ist bereit.</em>',
      titleRoot: 'Ihre Website –<br><em>vor allen anderen.</em>',
      lead: 'Geben Sie den Zugangscode ein, den Sie erhalten haben, um Ihre persönliche Vorschau zu öffnen. Alles hier wurde exklusiv für Sie vorbereitet.',
      leadRoot: 'Geben Sie Ihre Projekt-ID und Ihren Zugangscode ein, um Ihre persönliche Website-Vorschau zu öffnen.',
      project: 'Projekt',
      projectId: 'Projekt-ID',
      projectIdPlaceholder: 'z. B. cafe-alma',
      passcode: 'Zugangscode',
      passcodePlaceholder: 'XXXX-XXXX',
      remember: 'Dieses Gerät {days} Tage lang merken',
      submit: 'Vorschau öffnen',
      checking: 'Wird geprüft…',
      unlocked: 'Entsperrt',
      errorCode: 'Dieser Code passt leider nicht. Bitte prüfen Sie ihn und versuchen Sie es erneut.',
      errorProject: 'Bitte geben Sie Ihre Projekt-ID ein.',
      errorEmpty: 'Bitte geben Sie Ihren Zugangscode ein.',
      errorNetwork: 'Der Server ist nicht erreichbar. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
      errorFile: 'Diese Seite funktioniert nur über einen Webserver – siehe Hinweis unten.',
      errorWait: 'Zu viele Versuche. Bitte warten Sie {s} Sekunden.',
      help: 'Noch keinen Code erhalten?',
      helpLink: '{name} kontaktieren',
      helpSubject: 'Zugang zu meiner Website-Vorschau ({project})',
      footerNote: 'Vertrauliche Vorschau – bitte nicht weitergeben.',
      fileNotice: 'Sie haben diese Datei direkt vom Computer geöffnet. Die Code-Prüfung braucht einen Webserver – laden Sie das Portal hoch (oder starten Sie einen lokalen Server, siehe README) und öffnen Sie es über http(s).',
      accessGranted: 'Zugang gewährt',
      welcome: 'Willkommen, {name}',
      welcomeBack: 'Willkommen zurück, {name}',
      welcomeGeneric: 'Willkommen',
      welcomeBackGeneric: 'Willkommen zurück',
      desktop: 'Desktop',
      tablet: 'Tablet',
      mobile: 'Smartphone',
      rotate: 'Drehen',
      reload: 'Neu laden',
      back: 'Zurück',
      forward: 'Vorwärts',
      openNewTab: 'In neuem Tab öffnen',
      projectInfo: 'Projektinfos',
      feedback: 'Feedback',
      lock: 'Vorschau sperren',
      locked: 'Vorschau gesperrt',
      qrTitle: 'Auf dem Smartphone öffnen',
      qrText: 'Scannen Sie den Code mit der Kamera Ihres Smartphones, um die Vorschau auf Ihrem eigenen Gerät zu öffnen – ohne Code-Eingabe.',
      copyLink: 'Link kopieren',
      copied: 'Link kopiert',
      copyFailed: 'Kopieren fehlgeschlagen',
      loading: 'Vorschau wird geladen…',
      externalPage: 'Externe Seite',
      pages: 'Seiten',
      close: 'Schließen',
      readMore: 'Weiterlesen',
      infoTitle: 'Über diese Vorschau',
      updated: 'Aktualisiert am {date}',
      noteFrom: 'Nachricht von {name}',
      whatsNew: 'Neu in dieser Version',
      contactTitle: 'Fragen? Melden Sie sich gerne',
      email: 'E-Mail',
      call: 'Anrufen',
      whatsapp: 'WhatsApp',
      website: 'Website',
      giveFeedback: 'Feedback geben',
      confidential: 'Diese Vorschau ist vertraulich und noch nicht öffentlich. Bitte leiten Sie den Link nicht weiter.',
      language: 'Sprache',
      feedbackTitle: 'Feedback geben',
      feedbackLead: 'Was gefällt Ihnen? Was soll anders werden? Ihre Nachricht geht direkt an {name}.',
      feedbackPlaceholder: 'z. B. „Könnte das Logo auf der Startseite etwas größer sein?“',
      sendEmail: 'Per E-Mail senden',
      send: 'Feedback senden',
      sending: 'Wird gesendet…',
      sent: 'Vielen Dank! Ihr Feedback wurde gesendet.',
      sendError: 'Senden fehlgeschlagen. Bitte versuchen Sie es erneut oder nutzen Sie E-Mail.',
      feedbackEmpty: 'Bitte schreiben Sie zuerst eine kurze Nachricht.',
      mailSubject: 'Feedback: {title}',
      mailProject: 'Projekt',
      mailPage: 'Seite',
      mailDevice: 'Gerät',
      waHello: 'Hallo {name}, zur Vorschau von „{title}“: '
    }
  };

  var DEVICES = {
    tablet: { w: 820, h: 1180, bezel: 18, status: 0 },
    mobile: { w: 390, h: 844, bezel: 12, status: 46 }
  };
  var CHROME_H = 44;
  var STORE_KEY = 'preview-portal:v1';
  var SESSION_KEY = 'preview-portal:session';
  var ATTEMPTS_KEY = 'preview-portal:attempts';
  var LANG_KEY = 'preview-portal:lang';
  var NOTES_KEY = 'preview-portal:notes-seen';

  /* ---------- tiny helpers ---------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(name) { return '<svg class="icon"><use href="#i-' + name + '"/></svg>'; }
  function storage(kind) {
    try { var s = window[kind]; var k = '__pp'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (e) { return null; }
  }
  var local = storage('localStorage');
  var session = storage('sessionStorage');
  function readJson(store, key, fallback) {
    if (!store) return fallback;
    try { var v = JSON.parse(store.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function writeJson(store, key, value) {
    if (!store) return;
    try { store.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
  }
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '•';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function prettify(slug) {
    return String(slug || '').split('-').filter(Boolean).map(function (w) { return w[0].toUpperCase() + w.slice(1); }).join(' ');
  }
  function digits(phone) { return String(phone || '').replace(/[^\d]/g, '').replace(/^00/, ''); }
  function telHref(phone) { return 'tel:' + String(phone || '').replace(/[^\d+]/g, ''); }

  /* ---------- colors ---------- */

  function parseHex(hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function toHex(rgb) {
    return '#' + rgb.map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join('');
  }
  function rgbToHsl(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToRgb(hsl) {
    var h = ((hsl[0] % 360) + 360) % 360 / 360, s = hsl[1], l = hsl[2];
    if (!s) return [l * 255, l * 255, l * 255];
    function f(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
  }
  function luminance(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function applyColors() {
    var root = document.documentElement;
    var accent = parseHex(CFG.accent) || parseHex('#7C5CFF');
    var accent2 = parseHex(CFG.accent2);
    if (!accent2) {
      var hsl = rgbToHsl(accent);
      accent2 = hslToRgb([hsl[0] - 62, Math.max(hsl[1], 0.75), Math.min(Math.max(hsl[2], 0.55), 0.62)]);
    }
    root.style.setProperty('--accent', toHex(accent));
    root.style.setProperty('--accent-2', toHex(accent2));
    root.style.setProperty('--on-accent', luminance(accent) > 0.45 ? '#0b0b12' : '#ffffff');
  }

  function applyTheme() {
    var pref = CFG.theme || 'dark';
    var mq = window.matchMedia && matchMedia('(prefers-color-scheme: light)');
    function set() {
      var theme = pref === 'auto' ? (mq && mq.matches ? 'light' : 'dark') : (pref === 'light' ? 'light' : 'dark');
      document.documentElement.setAttribute('data-theme', theme);
      var meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f5f9' : '#07070b');
    }
    set();
    if (pref === 'auto' && mq && mq.addEventListener) mq.addEventListener('change', set);
  }

  /* ---------- i18n ---------- */

  var state = {
    lang: 'en',
    view: 'boot',
    slug: '',
    code: '',
    base: '',
    rawMeta: {},
    busy: false,
    device: 'desktop',
    landscape: false,
    compact: false,
    mounted: false,
    nav: { stack: [], index: -1, pending: null },
    lastHref: undefined,
    frameReady: null,
    resolveFrame: null
  };

  function detectLang() {
    var saved = local && local.getItem(LANG_KEY);
    if (saved && TEXTS[saved]) return saved;
    if (CFG.language && CFG.language !== 'auto' && TEXTS[CFG.language]) return CFG.language;
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < langs.length; i++) {
      var code = String(langs[i]).slice(0, 2).toLowerCase();
      if (TEXTS[code]) return code;
    }
    return 'en';
  }

  function t(key, vars) {
    var over = (CFG.texts && CFG.texts[state.lang]) || {};
    var s = over[key] != null ? over[key] : TEXTS[state.lang][key] != null ? TEXTS[state.lang][key] : TEXTS.en[key] != null ? TEXTS.en[key] : key;
    if (vars) {
      s = String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    }
    return s;
  }

  /** Values in preview.json/config can be plain strings or { de: '…', en: '…' } */
  function pick(v) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return v[state.lang] != null ? v[state.lang] : v.en != null ? v.en : v[Object.keys(v)[0]];
    }
    return v;
  }
  function str(v) {
    v = pick(v);
    return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
  }

  function formatDate(value) {
    var s = str(value);
    if (!s) return '';
    var d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00') : new Date(s);
    if (isNaN(d.getTime())) return s;
    try { return new Intl.DateTimeFormat(state.lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) { return s; }
  }
  function formatPercent(v) {
    try { return new Intl.NumberFormat(state.lang, { style: 'percent', maximumFractionDigits: 0 }).format(v); } catch (e) { return Math.round(v * 100) + '%'; }
  }

  /* ---------- config helpers ---------- */

  var brand = CFG.brand || {};
  var contact = CFG.contact || {};
  var feedbackCfg = CFG.feedback || {};
  var rememberDays = CFG.rememberDays == null ? 30 : Number(CFG.rememberDays) || 0;

  function contactName() { return str(contact.name) || str(brand.name) || ''; }
  function projectsBase() { return String(CFG.projectsFolder || 'projects').replace(/^\/+|\/+$/g, '') + '/'; }
  function isSafePath(p) {
    return !!p && !/^[a-z][a-z0-9+.-]*:/i.test(p) && p.charAt(0) !== '/' && p.split(/[\\/]/).indexOf('..') === -1;
  }

  function meta() {
    var m = state.rawMeta || {};
    var pages = Array.isArray(m.pages) ? m.pages.map(function (p) {
      if (typeof p === 'string') return { title: p, path: p };
      return { title: str(p && p.title) || str(p && p.path), path: str(p && p.path) };
    }).filter(function (p) { return isSafePath(p.path); }) : [];
    var changes = pick(m.changes);
    changes = Array.isArray(changes) ? changes.map(str).filter(Boolean) : (str(changes) ? [str(changes)] : []);
    var entry = str(m.entry) || 'index.html';
    if (!isSafePath(entry)) entry = 'index.html';
    var device = ['desktop', 'tablet', 'mobile'].indexOf(m.device) > -1 ? m.device : '';
    return {
      customer: str(m.customer),
      title: str(m.title) || prettify(state.slug),
      domain: str(m.domain).replace(/^https?:\/\//i, '').replace(/\/+$/, ''),
      version: str(m.version),
      updated: str(m.updated),
      note: str(m.note),
      changes: changes,
      pages: pages,
      entry: entry,
      device: device
    };
  }

  /* ---------- persistence ---------- */

  function recall(slug) {
    var sess = readJson(session, SESSION_KEY, {});
    if (sess[slug]) return sess[slug];
    var all = readJson(local, STORE_KEY, {});
    var rec = all[slug];
    if (rec && rec.code && rec.until > Date.now()) return rec.code;
    if (rec) { delete all[slug]; writeJson(local, STORE_KEY, all); }
    return '';
  }
  function persist(slug, code, rememberDevice) {
    var sess = readJson(session, SESSION_KEY, {});
    sess[slug] = code;
    writeJson(session, SESSION_KEY, sess);
    if (rememberDevice && rememberDays > 0) {
      var all = readJson(local, STORE_KEY, {});
      all[slug] = { code: code, until: Date.now() + rememberDays * 864e5 };
      writeJson(local, STORE_KEY, all);
    }
  }
  function forget(slug) {
    var sess = readJson(session, SESSION_KEY, {});
    delete sess[slug];
    writeJson(session, SESSION_KEY, sess);
    var all = readJson(local, STORE_KEY, {});
    delete all[slug];
    writeJson(local, STORE_KEY, all);
  }

  function attempts() { return readJson(session, ATTEMPTS_KEY, { count: 0, until: 0 }); }
  function waitSeconds() { return Math.max(0, Math.ceil((attempts().until - Date.now()) / 1000)); }
  function registerFailure() {
    var a = attempts();
    a.count += 1;
    if (a.count >= 5) a.until = Date.now() + (a.count >= 12 ? 60 : a.count >= 8 ? 30 : 10) * 1000;
    writeJson(session, ATTEMPTS_KEY, a);
  }
  function resetAttempts() { writeJson(session, ATTEMPTS_KEY, { count: 0, until: 0 }); }

  /* ---------- DOM ---------- */

  var el = {};
  function bindElements() {
    [
      'gate', 'welcome', 'viewer', 'access-form', 'project-chip', 'project-chip-id', 'project-field', 'project-input',
      'code-input', 'remember-row', 'remember-input', 'remember-label', 'submit-btn', 'submit-label', 'form-error',
      'gate-title', 'gate-lead', 'gate-help', 'file-notice', 'footer-copy', 'scene', 'welcome-eyebrow', 'welcome-title',
      'welcome-sub', 'v-title', 'v-customer', 'v-version', 'device-seg', 'rotate-btn', 'qr-btn', 'info-btn', 'open-btn',
      'lock-btn', 'feedback-btn', 'stage', 'device', 'frame', 'caption', 'nav-back', 'nav-forward', 'nav-reload',
      'url-host', 'url-path', 'pages', 'pages-btn', 'pages-list', 'scrim', 'info-drawer', 'info-body', 'feedback-modal',
      'feedback-form', 'feedback-lead', 'feedback-context', 'feedback-text', 'feedback-error', 'feedback-actions',
      'qr-popover', 'qr-code', 'qr-copy', 'note', 'note-title', 'note-role', 'note-text', 'note-more', 'toast'
    ].forEach(function (id) {
      el[id.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); })] = document.getElementById(id);
    });
    el.visual = $('.gate__visual');
    el.access = el.accessForm;
    el.spot = $('.backdrop__spot');
  }

  function settleReveals() {
    // Once the entrance animation has played, drop it so later animations (e.g. the shake) can't restart it.
    $$('.reveal').forEach(function (n) {
      n.addEventListener('animationend', function done(e) {
        if (e.target !== n || e.animationName !== 'reveal') return;
        n.classList.remove('reveal');
        n.removeEventListener('animationend', done);
      });
    });
  }

  function setView(view) {
    state.view = view;
    document.body.setAttribute('data-view', view);
    el.gate.inert = view !== 'gate';
    el.viewer.inert = view !== 'viewer';
  }

  /* ---------- rendering ---------- */

  function renderBrand() {
    $$('[data-brand-name]').forEach(function (n) { n.textContent = str(brand.name); });
    $$('[data-brand-tagline]').forEach(function (n) { n.textContent = str(brand.tagline); n.hidden = !str(brand.tagline); });
    $$('[data-brand-mark]').forEach(function (n) {
      if (str(brand.logo)) {
        n.classList.add('has-logo');
        n.innerHTML = '<img src="' + esc(str(brand.logo)) + '" alt="">';
      } else {
        n.textContent = initials(str(brand.name) || 'Preview');
      }
    });
    $$('[data-brand-link]').forEach(function (a) {
      a.setAttribute('aria-label', str(brand.name) || 'Home');
      if (str(brand.website)) {
        a.href = str(brand.website);
        a.target = '_blank';
        a.rel = 'noopener';
      }
    });
    $$('[data-avatar]').forEach(renderAvatar);
    el.footerCopy.textContent = '© ' + new Date().getFullYear() + ' ' + str(brand.name);
  }

  function renderAvatar(node) {
    if (str(contact.photo)) node.innerHTML = '<img src="' + esc(str(contact.photo)) + '" alt="">';
    else node.textContent = initials(contactName() || str(brand.name));
  }

  function applyTexts() {
    document.documentElement.lang = state.lang;
    $$('[data-i18n]').forEach(function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    $$('[data-i18n-label]').forEach(function (n) {
      var v = t(n.getAttribute('data-i18n-label'));
      n.setAttribute('aria-label', v);
      n.title = v;
    });
    $$('[data-tip-key]').forEach(function (n) {
      var v = t(n.getAttribute('data-tip-key'));
      n.setAttribute('data-tip', v);
      n.setAttribute('aria-label', v);
    });
    $$('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === state.lang)); });

    var hasProject = !!state.slug;
    el.gateTitle.innerHTML = t(hasProject ? 'title' : 'titleRoot');
    el.gateLead.textContent = t(hasProject ? 'lead' : 'leadRoot');
    el.projectInput.placeholder = t('projectIdPlaceholder');
    el.codeInput.placeholder = t('passcodePlaceholder');
    el.rememberLabel.textContent = t('remember', { days: rememberDays });
    if (!el.submitBtn.classList.contains('is-busy') && !el.submitBtn.classList.contains('is-done')) el.submitLabel.textContent = t('submit');
    el.feedbackText.placeholder = t('feedbackPlaceholder');

    var help = '';
    var name = contactName();
    if (str(contact.email)) {
      help = t('help') + ' <a href="mailto:' + esc(str(contact.email)) + '?subject=' + encodeURIComponent(t('helpSubject', { project: state.slug || '–' })) + '">' + esc(t('helpLink', { name: name })) + '</a>';
    } else if (str(contact.phone)) {
      help = t('help') + ' <a href="' + esc(telHref(contact.phone)) + '">' + esc(t('helpLink', { name: name })) + '</a>';
    }
    el.gateHelp.innerHTML = help;
    el.gateHelp.hidden = !help;
    el.fileNotice.textContent = t('fileNotice');

    document.title = state.view === 'viewer' || state.view === 'welcome'
      ? meta().title + ' · ' + t('docTitle')
      : t('docTitle') + (str(brand.name) ? ' · ' + str(brand.name) : '');

    if (state.mounted) {
      renderViewerHeader();
      layout();
      moveThumb();
      updateUrlBar();
    }
  }

  function setLang(lang) {
    if (!TEXTS[lang] || lang === state.lang) return;
    state.lang = lang;
    if (local) local.setItem(LANG_KEY, lang);
    applyTexts();
    if (el.infoDrawer.classList.contains('is-open')) renderInfo();
  }

  function renderGate() {
    var hasProject = !!state.slug;
    el.projectChip.hidden = !hasProject;
    el.projectField.hidden = hasProject;
    el.projectChipId.textContent = state.slug;
    el.rememberRow.hidden = rememberDays <= 0;
    el.fileNotice.hidden = location.protocol !== 'file:';
    applyTexts();
  }

  /* ---------- access ---------- */

  function showError(message, focusInput, shake) {
    el.formError.textContent = message;
    if (shake) {
      el.access.classList.remove('is-error');
      void el.access.offsetWidth;
      el.access.classList.add('is-error');
    }
    if (focusInput) {
      focusInput.focus();
      focusInput.select && focusInput.select();
    }
  }
  function clearError() {
    el.formError.textContent = '';
    el.access.classList.remove('is-error');
  }
  function setBusy(busy) {
    state.busy = busy;
    el.submitBtn.classList.toggle('is-busy', busy);
    el.submitBtn.disabled = busy;
    el.submitLabel.textContent = busy ? t('checking') : t('submit');
  }

  function safeJson(text) {
    try {
      var v = JSON.parse(text);
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch (e) {
      return null;
    }
  }

  /** Resolves to { base, meta } when the secret folder exists, null when not. Rejects on network errors. */
  function verify(slug, code) {
    var base = projectsBase() + Core.folderName(slug, code) + '/';
    var opts = { cache: 'no-store', credentials: 'same-origin' };
    return fetch(base + 'preview.json', opts).then(function (res) {
      if (!res.ok || res.redirected) return null;
      return res.text().then(function (text) {
        var json = safeJson(text);
        if (!json && text.indexOf('name="preview-portal"') === -1) console.warn('[Preview] preview.json exists but is not valid JSON – using defaults.');
        return json;
      });
    }).then(function (json) {
      if (json) return { base: base, meta: json };
      return fetch(base + 'index.html', opts).then(function (res) {
        if (!res.ok || res.redirected) return null;
        return res.text().then(function (html) {
          // Some hosts answer every unknown URL with the start page – that's not a real project.
          return html.indexOf('name="preview-portal"') > -1 ? null : { base: base, meta: {} };
        });
      });
    });
  }

  function attempt(slug, code, opts) {
    opts = opts || {};
    var started = Date.now();
    var minTime = opts.silent ? 0 : 700;
    setBusy(true);
    clearError();
    return verify(slug, code).then(function (result) {
      return sleep(Math.max(0, minTime - (Date.now() - started))).then(function () { return result; });
    }, function (err) {
      return sleep(Math.max(0, minTime - (Date.now() - started))).then(function () { throw err; });
    }).then(function (result) {
      if (!result) {
        setBusy(false);
        if (opts.silent) return false;
        registerFailure();
        showError(t('errorCode'), el.codeInput, true);
        return false;
      }
      resetAttempts();
      state.slug = slug;
      state.code = Core.normalizeCode(code);
      state.base = result.base;
      state.rawMeta = result.meta;
      persist(slug, state.code, opts.remember);
      setUrl(slug);
      return celebrate(opts.silent).then(function () {
        return enterViewer(!!opts.returning);
      }).then(function () { return true; });
    }).catch(function (err) {
      console.error('[Preview]', err);
      setBusy(false);
      if (!opts.silent) showError(t(location.protocol === 'file:' ? 'errorFile' : 'errorNetwork'));
      return 'error';
    });
  }

  function celebrate(silent) {
    state.busy = false;
    el.submitBtn.classList.remove('is-busy');
    el.submitBtn.classList.add('is-done');
    el.submitLabel.textContent = t('unlocked');
    el.gate.classList.add('is-unlocked');
    return sleep(silent || reduceMotion ? 0 : 750);
  }

  function setUrl(slug) {
    try { history.replaceState(null, '', location.pathname + '?p=' + encodeURIComponent(slug)); } catch (e) { /* ignore */ }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (state.busy) return;
    var slug = state.slug || Core.slugify(el.projectInput.value);
    var code = el.codeInput.value;
    if (!slug) return showError(t('errorProject'), el.projectInput, true);
    if (!Core.normalizeCode(code)) return showError(t('errorEmpty'), el.codeInput, true);
    var wait = waitSeconds();
    if (wait) return showError(t('errorWait', { s: wait }), null, true);
    attempt(slug, code, { remember: el.rememberInput.checked });
  }

  function typeIn(code) {
    var chars = Array.from(code);
    el.codeInput.value = '';
    return chars.reduce(function (p, ch) {
      return p.then(function () {
        el.codeInput.value += ch;
        return sleep(reduceMotion ? 0 : 55);
      });
    }, sleep(reduceMotion ? 0 : 900)).then(function () { return sleep(reduceMotion ? 0 : 250); });
  }

  /* ---------- welcome ---------- */

  function renderWelcome(returning) {
    var m = meta();
    var name = m.customer;
    var tpl = name ? t(returning ? 'welcomeBack' : 'welcome') : t(returning ? 'welcomeBackGeneric' : 'welcomeGeneric');
    var runs = [];
    tpl.split('{name}').forEach(function (part, i, arr) {
      if (part) runs.push({ text: part, em: false });
      if (i < arr.length - 1) runs.push({ text: name, em: true });
    });
    var words = [];
    var current = [];
    runs.forEach(function (run) {
      run.text.split(/(\s+)/).forEach(function (piece) {
        if (!piece) return;
        if (/^\s+$/.test(piece)) {
          if (current.length) { words.push(current); current = []; }
        } else {
          current.push({ text: piece, em: run.em });
        }
      });
    });
    if (current.length) words.push(current);
    el.welcomeTitle.innerHTML = words.map(function (segs, i) {
      return '<span class="word" style="--w:' + i + '"><span>' + segs.map(function (s) {
        return s.em ? '<em>' + esc(s.text) + '</em>' : esc(s.text);
      }).join('') + '</span></span>';
    }).join(' ');
    el.welcomeEyebrow.textContent = t('accessGranted');
    el.welcomeSub.textContent = [m.title, m.version].filter(Boolean).join(' · ');
  }

  function enterViewer(returning) {
    mountViewer();
    renderWelcome(returning);
    setView('welcome');
    applyTexts();
    var hold = reduceMotion ? 400 : returning ? 1500 : 2300;
    return Promise.race([
      Promise.all([sleep(hold), state.frameReady]),
      sleep(hold + 3500)
    ]).then(function () {
      setView('viewer');
      requestAnimationFrame(function () { layout(); moveThumb(); });
      var m = meta();
      if (m.note) setTimeout(function () { maybeShowNote(m); }, reduceMotion ? 200 : 1300);
    });
  }

  /* ---------- viewer ---------- */

  function renderViewerHeader() {
    var m = meta();
    el.vTitle.textContent = m.title;
    el.vCustomer.textContent = m.customer || str(brand.name);
    el.vVersion.textContent = m.version;
    el.vVersion.hidden = !m.version;
    renderPagesMenu();
  }

  function createFrame(src) {
    var old = el.frame;
    var frame = document.createElement('iframe');
    frame.id = 'frame';
    frame.title = meta().title || 'Website preview';
    frame.setAttribute('allow', 'fullscreen; clipboard-write');
    frame.addEventListener('load', onFrameLoad);
    frame.src = src;
    if (old) old.replaceWith(frame);
    el.frame = frame;
  }

  function mountViewer() {
    var m = meta();
    state.mounted = true;
    state.nav = { stack: [], index: -1, pending: null };
    state.lastHref = undefined;
    state.frameReady = new Promise(function (resolve) { state.resolveFrame = resolve; });
    renderViewerHeader();
    var src = state.base + m.entry;
    el.openBtn.href = src;
    el.device.classList.add('is-loading');
    el.viewer.classList.add('is-resizing');
    createFrame(src);
    var qrAvailable = CFG.showQrCode !== false && !!window.PreviewQR;
    el.qrBtn.hidden = !qrAvailable;
    state.device = m.device || (['desktop', 'tablet', 'mobile'].indexOf(CFG.defaultDevice) > -1 ? CFG.defaultDevice : 'desktop');
    state.landscape = false;
    applyDevice();
    setTimeout(function () { el.viewer.classList.remove('is-resizing'); }, 80);
  }

  function unmountViewer() {
    state.mounted = false;
    closeAll();
    if (el.frame) {
      var blank = document.createElement('iframe');
      blank.id = 'frame';
      el.frame.replaceWith(blank);
      el.frame = blank;
    }
  }

  function effectiveDevice() { return state.compact ? 'desktop' : state.device; }

  function applyDevice() {
    var dev = effectiveDevice();
    if (dev === 'desktop') state.landscape = false;
    el.device.setAttribute('data-device', dev);
    el.device.classList.toggle('is-landscape', state.landscape);
    el.viewer.setAttribute('data-device', dev);
    el.viewer.classList.toggle('is-landscape-mode', state.landscape);
    $$('button[data-device]', el.deviceSeg).forEach(function (b) {
      var on = b.getAttribute('data-device') === dev;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    moveThumb();
    layout();
    styleFrame();
  }

  /** Touch devices have no visible scrollbars – mimic that inside the tablet/phone frames. */
  function styleFrame() {
    var doc;
    try { doc = el.frame && el.frame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.documentElement) return;
    var style = doc.getElementById('__preview-portal-style');
    if (!style) {
      style = doc.createElement('style');
      style.id = '__preview-portal-style';
      style.textContent = 'html.__pp-touch, html.__pp-touch * { scrollbar-width: none; }' +
        'html.__pp-touch::-webkit-scrollbar, html.__pp-touch *::-webkit-scrollbar { display: none; }';
      (doc.head || doc.documentElement).appendChild(style);
    }
    doc.documentElement.classList.toggle('__pp-touch', effectiveDevice() !== 'desktop');
  }

  function setDevice(dev) {
    if (['desktop', 'tablet', 'mobile'].indexOf(dev) === -1) return;
    if (dev !== state.device) state.landscape = false;
    state.device = dev;
    applyDevice();
  }

  function moveThumb() {
    var btn = $('button[aria-checked="true"]', el.deviceSeg);
    if (!btn || !btn.offsetWidth) return;
    el.deviceSeg.style.setProperty('--thumb-x', btn.offsetLeft + 'px');
    el.deviceSeg.style.setProperty('--thumb-w', btn.offsetWidth + 'px');
  }

  function layout() {
    if (!state.mounted) return;
    if (state.compact) {
      el.caption.textContent = '';
      return;
    }
    var W = el.stage.clientWidth;
    var H = el.stage.clientHeight;
    if (!W || !H) return;
    var padX = W < 900 ? 18 : 36;
    var padTop = 24;
    var padBottom = 44;
    var availW = Math.max(240, W - padX * 2);
    var availH = Math.max(240, H - padTop - padBottom);
    var dev = effectiveDevice();
    var sw, sh, scale = 1;
    if (dev === 'desktop') {
      sw = Math.floor(availW);
      sh = Math.floor(availH - CHROME_H);
    } else {
      var d = DEVICES[dev];
      sw = state.landscape ? d.h : d.w;
      sh = state.landscape ? d.w : d.h;
      var status = dev === 'mobile' && !state.landscape ? d.status : 0;
      var totalW = sw + d.bezel * 2 + 14;
      var totalH = sh + d.bezel * 2 + status + 14;
      scale = Math.min(1, availW / totalW, availH / totalH);
    }
    el.device.style.setProperty('--sw', sw + 'px');
    el.device.style.setProperty('--sh', sh + 'px');
    el.device.style.setProperty('--scale', scale.toFixed(4));
    el.device.style.setProperty('--cy', Math.round(padTop + availH / 2) + 'px');
    state.screen = { w: sw, h: sh };
    el.caption.textContent = t(dev) + ' · ' + sw + ' × ' + sh + (scale < 0.995 ? ' · ' + formatPercent(scale) : '');
  }

  /* iframe: navigation, URL bar, external links */

  function frameHref() {
    try {
      var href = el.frame.contentWindow.location.href;
      return href === 'about:blank' ? '' : href;
    } catch (e) {
      return null; // cross-origin (an external site inside the frame)
    }
  }

  function relPath(href) {
    if (!href) return '';
    var url, base;
    try {
      url = new URL(href);
      base = new URL(state.base, location.href);
    } catch (e) {
      return null;
    }
    if (url.origin !== base.origin || url.pathname.indexOf(base.pathname) !== 0) return null;
    var rel = url.pathname.slice(base.pathname.length).replace(/(^|\/)index\.html?$/i, '$1');
    try { rel = decodeURIComponent(rel); } catch (e) { /* keep encoded */ }
    return rel + url.search + url.hash;
  }

  function currentPage() {
    var rel = relPath(frameHref());
    return rel === null ? t('externalPage') : '/' + rel;
  }

  function updateUrlBar() {
    var m = meta();
    var rel = relPath(frameHref());
    if (rel === null) {
      el.urlHost.textContent = t('externalPage');
      el.urlPath.textContent = '';
    } else {
      el.urlHost.textContent = m.domain || state.slug;
      el.urlPath.textContent = rel ? '/' + rel : '';
    }
    updatePagesCurrent(rel);
  }

  function updateNav() {
    el.navBack.disabled = state.nav.index <= 0;
    el.navForward.disabled = state.nav.index >= state.nav.stack.length - 1;
  }

  var loaderTimer;
  function onFrameLoad() {
    clearTimeout(loaderTimer);
    el.device.classList.remove('is-loading');
    if (state.resolveFrame) { state.resolveFrame(); state.resolveFrame = null; }
    var href = frameHref();
    var nav = state.nav;
    if (nav.pending !== null) {
      nav.index = nav.pending;
      nav.pending = null;
    } else if (href && href !== nav.stack[nav.index]) {
      nav.stack = nav.stack.slice(0, nav.index + 1);
      nav.stack.push(href);
      nav.index = nav.stack.length - 1;
    }
    updateNav();
    state.lastHref = href;
    updateUrlBar();
    patchFrame();
    styleFrame();
  }

  function patchFrame() {
    var win, doc;
    try {
      win = el.frame.contentWindow;
      doc = el.frame.contentDocument;
    } catch (e) {
      return;
    }
    if (!doc || !win || doc.__previewPatched) return;
    doc.__previewPatched = true;
    // Links to other websites open in a new tab instead of inside the small frame.
    doc.addEventListener('click', function (e) {
      var target = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!target) return;
      var url;
      try { url = new URL(target.href, doc.baseURI); } catch (err) { return; }
      if (!/^https?:$/.test(url.protocol)) return;
      if (url.origin !== location.origin) {
        target.setAttribute('target', '_blank');
        target.setAttribute('rel', 'noopener');
      } else if (target.target === '_top' || target.target === '_parent') {
        target.setAttribute('target', '_self');
      }
    }, true);
    // Clicking into the preview closes open menus of the viewer.
    doc.addEventListener('pointerdown', function () {
      togglePagesMenu(false);
      closePanel(el.qrPopover);
    }, true);
    // Show a loader when a page takes a moment.
    win.addEventListener('pagehide', function () {
      clearTimeout(loaderTimer);
      loaderTimer = setTimeout(function () { el.device.classList.add('is-loading'); }, 250);
    });
  }

  function navigateFrame(url, replace) {
    try {
      if (replace) el.frame.contentWindow.location.replace(url);
      else el.frame.contentWindow.location.href = url;
    } catch (e) {
      el.frame.src = url;
    }
  }

  function go(delta) {
    var nav = state.nav;
    var target = nav.index + delta;
    if (target < 0 || target >= nav.stack.length) return;
    nav.pending = target;
    navigateFrame(nav.stack[target], true);
  }

  function pollFrame() {
    if (state.view !== 'viewer' || !state.mounted) return;
    var href = frameHref();
    if (href !== state.lastHref) {
      state.lastHref = href;
      updateUrlBar();
    }
  }

  /* Pages menu */

  function renderPagesMenu() {
    var m = meta();
    el.pages.hidden = !m.pages.length;
    el.pagesList.innerHTML = m.pages.map(function (p, i) {
      return '<button type="button" role="menuitem" data-page="' + i + '"><span>' + esc(p.title) + '</span><small>' + esc(p.path) + '</small></button>';
    }).join('');
  }

  function normalizePagePath(p) { return String(p || '').replace(/^\.?\//, '').replace(/(^|\/)index\.html?$/i, '$1'); }

  function updatePagesCurrent(rel) {
    var m = meta();
    var cur = normalizePagePath(String(rel || '').split(/[?#]/)[0]);
    $$('button[data-page]', el.pagesList).forEach(function (b) {
      var p = m.pages[Number(b.getAttribute('data-page'))];
      b.classList.toggle('is-current', !!p && normalizePagePath(p.path.split(/[?#]/)[0]) === cur);
    });
  }

  function openPage(index) {
    var p = meta().pages[index];
    if (!p) return;
    navigateFrame(new URL(state.base + p.path, location.href).href, false);
    togglePagesMenu(false);
    closeAll();
  }

  function togglePagesMenu(force) {
    var open = force != null ? force : !el.pages.classList.contains('is-open');
    el.pages.classList.toggle('is-open', open);
    el.pagesBtn.setAttribute('aria-expanded', String(open));
  }

  /* ---------- panels ---------- */

  var lastFocus = null;

  function openPanel(panel, withScrim) {
    closeAll(panel);
    lastFocus = document.activeElement;
    panel.inert = false;
    panel.classList.add('is-open');
    if (withScrim) el.scrim.classList.add('is-open');
    var focusable = panel === el.feedbackModal ? el.feedbackText : panel === el.qrPopover ? el.qrCopy : $('[data-close]', panel);
    if (focusable) setTimeout(function () { focusable.focus({ preventScroll: true }); }, 60);
  }

  function closePanel(panel) {
    if (!panel.classList.contains('is-open')) return;
    panel.classList.remove('is-open');
    panel.inert = true;
    if (panel === el.qrPopover) el.qrBtn.setAttribute('aria-expanded', 'false');
    if (!$('.drawer.is-open, .modal.is-open')) el.scrim.classList.remove('is-open');
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  function closeAll(except) {
    [el.infoDrawer, el.feedbackModal, el.qrPopover].forEach(function (p) { if (p !== except) closePanel(p); });
    togglePagesMenu(false);
  }

  function contactActionsHtml(includeFeedback) {
    var m = meta();
    var html = '';
    if (includeFeedback) html += '<button type="button" class="btn btn--primary btn--sm" data-action="feedback">' + icon('message') + '<span>' + esc(t('giveFeedback')) + '</span></button>';
    if (str(contact.email)) html += '<a class="btn btn--ghost btn--sm" href="mailto:' + esc(str(contact.email)) + '?subject=' + encodeURIComponent(t('mailSubject', { title: m.title })) + '">' + icon('mail') + '<span>' + esc(t('email')) + '</span></a>';
    if (str(contact.phone)) html += '<a class="btn btn--ghost btn--sm" href="' + esc(telHref(contact.phone)) + '">' + icon('call') + '<span>' + esc(t('call')) + '</span></a>';
    if (str(contact.whatsapp)) html += '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://wa.me/' + digits(contact.whatsapp) + '?text=' + encodeURIComponent(t('waHello', { name: contactName(), title: m.title })) + '">' + icon('whatsapp') + '<span>' + esc(t('whatsapp')) + '</span></a>';
    if (str(brand.website)) html += '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="' + esc(str(brand.website)) + '">' + icon('globe') + '<span>' + esc(t('website')) + '</span></a>';
    return html;
  }

  function renderInfo() {
    var m = meta();
    var html = '';
    var metaBits = [];
    if (m.version) metaBits.push('<span class="badge">' + esc(m.version) + '</span>');
    if (m.updated) metaBits.push('<span>' + icon('clock') + esc(t('updated', { date: formatDate(m.updated) })) + '</span>');
    html += '<section class="info-hero">' +
      (m.customer ? '<p class="info-hero__customer">' + esc(m.customer) + '</p>' : '') +
      '<h3 class="info-hero__title">' + esc(m.title) + '</h3>' +
      (metaBits.length ? '<div class="info-hero__meta">' + metaBits.join('') + '</div>' : '') +
      '</section>';

    if (m.note) {
      html += '<section class="info-card"><div class="info-card__head"><span class="avatar" data-avatar></span><div><strong>' +
        esc(t('noteFrom', { name: contactName() })) + '</strong><small>' + esc(str(contact.role)) + '</small></div></div><p>' + esc(m.note) + '</p></section>';
    }
    if (m.changes.length) {
      html += '<section class="info-section"><h4>' + esc(t('whatsNew')) + '</h4><ul class="checklist">' +
        m.changes.map(function (c) { return '<li>' + icon('check') + '<span>' + esc(c) + '</span></li>'; }).join('') + '</ul></section>';
    }
    if (m.pages.length) {
      html += '<section class="info-section"><h4>' + esc(t('pages')) + '</h4><div class="page-links">' +
        m.pages.map(function (p, i) { return '<button type="button" data-page="' + i + '"><span>' + esc(p.title) + '</span><small>' + esc(p.path) + '</small></button>'; }).join('') +
        '</div></section>';
    }
    var actions = contactActionsHtml(true);
    html += '<section class="info-card"><div class="info-card__head"><span class="avatar" data-avatar></span><div><strong>' + esc(t('contactTitle')) + '</strong><small>' +
      esc([contactName(), str(contact.role)].filter(Boolean).join(' · ')) + '</small></div></div><div class="contact-actions">' + actions + '</div></section>';
    html += '<p class="drawer__foot">' + icon('lock') + '<span>' + esc(t('confidential')) + '</span></p>';
    html += '<div class="drawer__lang"><span>' + esc(t('language')) + '</span><div class="lang" role="group">' +
      Object.keys(TEXTS).map(function (l) { return '<button type="button" data-lang="' + l + '" aria-pressed="' + (l === state.lang) + '">' + l.toUpperCase() + '</button>'; }).join('') +
      '</div></div>';
    el.infoBody.innerHTML = html;
    $$('[data-avatar]', el.infoBody).forEach(renderAvatar);
  }

  function openInfo() {
    renderInfo();
    openPanel(el.infoDrawer, true);
  }

  function deviceLabel() {
    var dev = effectiveDevice();
    if (state.compact) return t('mobile') + ' (' + window.innerWidth + ' × ' + window.innerHeight + ')';
    var d = DEVICES[dev];
    if (!d) return t('desktop') + ' (' + ((state.screen && state.screen.w) || el.stage.clientWidth) + ' × ' + ((state.screen && state.screen.h) || el.stage.clientHeight) + ')';
    var w = state.landscape ? d.h : d.w;
    var h = state.landscape ? d.w : d.h;
    return t(dev) + ' (' + w + ' × ' + h + ')';
  }

  function feedbackText(message) {
    var m = meta();
    return message.trim() + '\n\n—\n' +
      t('mailProject') + ': ' + m.title + (m.customer ? ' (' + m.customer + ')' : '') + (m.version ? ' · ' + m.version : '') + '\n' +
      t('mailPage') + ': ' + currentPage() + '\n' +
      t('mailDevice') + ': ' + deviceLabel();
  }

  function openFeedback() {
    var endpoint = str(feedbackCfg.formEndpoint);
    el.feedbackLead.textContent = t('feedbackLead', { name: contactName() });
    el.feedbackContext.innerHTML =
      '<span>' + icon('file') + esc(t('mailPage')) + ' <b>' + esc(currentPage()) + '</b></span>' +
      '<span>' + icon(effectiveDevice() === 'desktop' && !state.compact ? 'monitor' : effectiveDevice() === 'tablet' ? 'tablet' : 'phone') + '<b>' + esc(deviceLabel()) + '</b></span>';
    var actions = '';
    if (str(contact.whatsapp)) actions += '<button type="button" class="btn btn--ghost" data-send="whatsapp">' + icon('whatsapp') + '<span>' + esc(t('whatsapp')) + '</span></button>';
    if (endpoint && str(contact.email)) actions += '<button type="button" class="btn btn--ghost" data-send="email">' + icon('mail') + '<span>' + esc(t('sendEmail')) + '</span></button>';
    if (endpoint) actions += '<button type="submit" class="btn btn--primary" data-send="form">' + icon('send') + '<span>' + esc(t('send')) + '</span></button>';
    else if (str(contact.email)) actions += '<button type="submit" class="btn btn--primary" data-send="email">' + icon('mail') + '<span>' + esc(t('sendEmail')) + '</span></button>';
    el.feedbackActions.innerHTML = actions;
    el.feedbackError.textContent = '';
    el.feedbackError.classList.remove('is-success');
    openPanel(el.feedbackModal, true);
  }

  function sendFeedback(channel) {
    var message = el.feedbackText.value;
    el.feedbackError.classList.remove('is-success');
    if (!message.trim()) {
      el.feedbackError.textContent = t('feedbackEmpty');
      el.feedbackText.focus();
      return;
    }
    el.feedbackError.textContent = '';
    var m = meta();
    var body = feedbackText(message);
    if (channel === 'email') {
      window.location.href = 'mailto:' + str(contact.email) + '?subject=' + encodeURIComponent(t('mailSubject', { title: m.title })) + '&body=' + encodeURIComponent(body);
      return;
    }
    if (channel === 'whatsapp') {
      window.open('https://wa.me/' + digits(contact.whatsapp) + '?text=' + encodeURIComponent(body), '_blank', 'noopener');
      return;
    }
    // Form service (Formspree, Web3Forms, …)
    var submitBtn = $('[data-send="form"]', el.feedbackActions);
    var data = new FormData();
    data.append('message', message.trim());
    data.append('project', m.title);
    data.append('customer', m.customer);
    data.append('version', m.version);
    data.append('page', currentPage());
    data.append('device', deviceLabel());
    data.append('subject', t('mailSubject', { title: m.title }));
    data.append('_subject', t('mailSubject', { title: m.title }));
    var extra = feedbackCfg.extraFields || {};
    Object.keys(extra).forEach(function (k) { data.append(k, extra[k]); });
    if (submitBtn) { submitBtn.disabled = true; submitBtn.querySelector('span').textContent = t('sending'); }
    fetch(str(feedbackCfg.formEndpoint), { method: 'POST', body: data, headers: { Accept: 'application/json' } }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      el.feedbackText.value = '';
      el.feedbackError.textContent = t('sent');
      el.feedbackError.classList.add('is-success');
      setTimeout(function () { closePanel(el.feedbackModal); }, 1800);
    }).catch(function () {
      el.feedbackError.textContent = t('sendError');
    }).then(function () {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.querySelector('span').textContent = t('send'); }
    });
  }

  function shareLink(withCode) {
    return location.origin + location.pathname + '?p=' + encodeURIComponent(state.slug) + (withCode ? '#code=' + encodeURIComponent(state.code) : '');
  }

  function toggleQr() {
    if (el.qrPopover.classList.contains('is-open')) return closePanel(el.qrPopover);
    el.qrCode.innerHTML = window.PreviewQR.svg(shareLink(true), { ecl: 'M', margin: 0, color: '#0b0b12', title: t('qrTitle') });
    var rect = el.qrBtn.getBoundingClientRect();
    var width = 280;
    var left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left + rect.width / 2 - width / 2));
    el.qrPopover.style.left = left + 'px';
    el.qrPopover.style.right = 'auto';
    openPanel(el.qrPopover, false);
    el.qrBtn.setAttribute('aria-expanded', 'true');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  var toastTimer;
  function toast(message, iconName) {
    el.toast.innerHTML = icon(iconName || 'check') + '<span>' + esc(message) + '</span>';
    el.toast.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('is-open'); }, 2200);
  }

  function maybeShowNote(m) {
    if (state.view !== 'viewer') return;
    var key = state.slug + '|' + m.version + '|' + Core.sha256Hex(m.note).slice(0, 8);
    var seen = readJson(local, NOTES_KEY, []);
    if (seen.indexOf(key) > -1) return;
    seen.push(key);
    writeJson(local, NOTES_KEY, seen.slice(-50));
    el.noteTitle.textContent = t('noteFrom', { name: contactName() });
    el.noteRole.textContent = str(contact.role);
    el.noteText.textContent = m.note;
    el.note.inert = false;
    el.note.classList.add('is-open');
  }
  function hideNote() {
    el.note.classList.remove('is-open');
    el.note.inert = true;
  }

  function lockPreview() {
    forget(state.slug);
    hideNote();
    closeAll();
    el.gate.classList.remove('is-unlocked');
    el.submitBtn.classList.remove('is-done', 'is-busy');
    el.submitBtn.disabled = false;
    state.busy = false;
    el.codeInput.value = '';
    clearError();
    setView('gate');
    applyTexts();
    toast(t('locked'), 'lock');
    setTimeout(function () { if (state.view === 'gate') unmountViewer(); }, 900);
    setTimeout(function () { el.codeInput.focus({ preventScroll: true }); }, 700);
  }

  /* ---------- events ---------- */

  function bindEvents() {
    el.accessForm.addEventListener('submit', onSubmit);
    el.codeInput.addEventListener('input', function () { if (el.formError.textContent) clearError(); });
    el.projectInput.addEventListener('input', function () { if (el.formError.textContent) clearError(); });

    $$('.lang button[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
    });

    // Pointer effects on the access screen (parallax, spotlight)
    var raf = 0;
    var pointer = { x: 0, y: 0 };
    window.addEventListener('pointermove', function (e) {
      if (state.view !== 'gate' || e.pointerType === 'touch') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        el.spot.style.setProperty('--mx', pointer.x + 'px');
        el.spot.style.setProperty('--my', pointer.y + 'px');
        var nx = pointer.x / window.innerWidth - 0.5;
        var ny = pointer.y / window.innerHeight - 0.5;
        if (el.visual) {
          el.visual.style.setProperty('--ry', (nx * 12).toFixed(2) + 'deg');
          el.visual.style.setProperty('--rx', (ny * -8).toFixed(2) + 'deg');
        }
        var r = el.access.getBoundingClientRect();
        el.access.style.setProperty('--cx', (pointer.x - r.left) + 'px');
        el.access.style.setProperty('--cy', (pointer.y - r.top) + 'px');
      });
    }, { passive: true });

    // Viewer controls
    $$('button[data-device]', el.deviceSeg).forEach(function (b) {
      b.addEventListener('click', function () { setDevice(b.getAttribute('data-device')); });
    });
    el.deviceSeg.addEventListener('keydown', function (e) {
      var order = ['desktop', 'tablet', 'mobile'];
      var i = order.indexOf(state.device);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = (i + 1) % order.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = (i + order.length - 1) % order.length;
      else return;
      e.preventDefault();
      setDevice(order[i]);
      $('button[data-device="' + order[i] + '"]', el.deviceSeg).focus();
    });
    el.rotateBtn.addEventListener('click', function () {
      if (effectiveDevice() === 'desktop') return;
      state.landscape = !state.landscape;
      applyDevice();
    });
    el.navBack.addEventListener('click', function () { go(-1); });
    el.navForward.addEventListener('click', function () { go(1); });
    el.navReload.addEventListener('click', function () {
      try { el.frame.contentWindow.location.reload(); } catch (e) { el.frame.src = el.frame.src; }
    });
    el.pagesBtn.addEventListener('click', function (e) { e.stopPropagation(); togglePagesMenu(); });
    document.addEventListener('click', function (e) {
      var pageBtn = e.target.closest && e.target.closest('button[data-page]');
      if (pageBtn) { openPage(Number(pageBtn.getAttribute('data-page'))); return; }
      var langBtn = e.target.closest && e.target.closest('.drawer__lang button[data-lang]');
      if (langBtn) { setLang(langBtn.getAttribute('data-lang')); return; }
      if (e.target.closest && e.target.closest('[data-action="feedback"]')) { openFeedback(); return; }
      if (e.target.closest && e.target.closest('[data-close]')) {
        var panel = e.target.closest('.drawer, .modal, .popover, .note');
        if (panel === el.note) hideNote();
        else if (panel) closePanel(panel);
        return;
      }
      if (el.pages.classList.contains('is-open') && !el.pages.contains(e.target)) togglePagesMenu(false);
      if (el.qrPopover.classList.contains('is-open') && !el.qrPopover.contains(e.target) && !el.qrBtn.contains(e.target)) closePanel(el.qrPopover);
    });

    el.qrBtn.addEventListener('click', toggleQr);
    el.qrCopy.addEventListener('click', function () {
      copyText(shareLink(false)).then(function (ok) { toast(ok ? t('copied') : t('copyFailed'), ok ? 'check' : 'x'); });
    });
    el.infoBtn.addEventListener('click', openInfo);
    el.feedbackBtn.addEventListener('click', openFeedback);
    el.lockBtn.addEventListener('click', lockPreview);
    el.noteMore.addEventListener('click', function () { hideNote(); openInfo(); });
    el.scrim.addEventListener('click', function () { closeAll(); });

    el.feedbackForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var primary = $('.btn--primary[data-send]', el.feedbackActions);
      sendFeedback(primary ? primary.getAttribute('data-send') : 'email');
    });
    el.feedbackActions.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-send]');
      if (!b || b.type === 'submit') return;
      sendFeedback(b.getAttribute('data-send'));
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if ($('.drawer.is-open, .modal.is-open, .popover.is-open') || el.pages.classList.contains('is-open')) closeAll();
        else if (el.note.classList.contains('is-open')) hideNote();
        return;
      }
      if (state.view !== 'viewer' || state.compact || e.metaKey || e.ctrlKey || e.altKey) return;
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || $('.drawer.is-open, .modal.is-open')) return;
      var map = { '1': 'desktop', '2': 'tablet', '3': 'mobile' };
      if (map[e.key]) setDevice(map[e.key]);
    });

    // Layout
    var resizeTimer;
    function onResize() {
      el.viewer.classList.add('is-resizing');
      layout();
      moveThumb();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { el.viewer.classList.remove('is-resizing'); }, 160);
    }
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(el.stage);
    else window.addEventListener('resize', onResize);

    var compactMq = window.matchMedia('(max-width: 760px)');
    function setCompact() {
      state.compact = compactMq.matches;
      document.body.classList.toggle('is-compact', state.compact);
      if (state.mounted) applyDevice();
    }
    setCompact();
    if (compactMq.addEventListener) compactMq.addEventListener('change', setCompact);
    else if (compactMq.addListener) compactMq.addListener(setCompact);

    setInterval(pollFrame, 400);

    window.addEventListener('hashchange', function () {
      var url = readUrl();
      if (!url.code || !url.slug || state.view !== 'gate' || state.busy) return;
      state.slug = url.slug;
      renderGate();
      typeIn(url.code).then(function () { attempt(state.slug, url.code, { remember: el.rememberInput.checked }); });
    });
  }

  /* ---------- start ---------- */

  function readUrl() {
    var params = new URLSearchParams(location.search);
    var slug = params.get('p') || params.get('project') || '';
    if (!slug && location.search.length > 1 && location.search.indexOf('=') === -1) {
      try { slug = decodeURIComponent(location.search.slice(1)); } catch (e) { slug = location.search.slice(1); }
    }
    var hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    var code = hash.get('code') || hash.get('c') || '';
    if (code) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    }
    return { slug: Core.slugify(slug), code: code };
  }

  function start() {
    if (!Core) {
      console.error('[Preview] core.js is missing.');
      return;
    }
    bindElements();
    applyColors();
    applyTheme();
    state.lang = detectLang();

    var url = readUrl();
    state.slug = url.slug;
    renderBrand();
    renderGate();
    bindEvents();
    settleReveals();

    var remembered = state.slug ? recall(state.slug) : '';

    if (state.slug && url.code) {
      // Magic link (e.g. scanned QR code): show the code being typed in, then unlock.
      setView('gate');
      typeIn(url.code).then(function () { attempt(state.slug, url.code, { remember: el.rememberInput.checked }); });
    } else if (state.slug && remembered) {
      // Returning visitor on a remembered device: straight to the welcome screen.
      attempt(state.slug, remembered, { silent: true, returning: true, remember: false }).then(function (result) {
        if (result === true) return;
        if (result === 'error') showError(t('errorNetwork'));
        else forget(state.slug);
        setView('gate');
        applyTexts();
      });
    } else {
      setView('gate');
      applyTexts();
      setTimeout(function () {
        var input = state.slug ? el.codeInput : el.projectInput;
        if (window.matchMedia('(hover: hover)').matches) input.focus({ preventScroll: true });
      }, 900);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
