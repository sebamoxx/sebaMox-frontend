/**
 * consoleHijack.js  —  Console Blindata con Password + Hacker Screen
 * ─────────────────────────────────────────────────────────────────────
 * Uso: import './utils/consoleHijack'  ← primissima riga di main.jsx
 *
 * Flusso:
 *   1. Gli errori vengono silenziati e messi in una coda
 *   2. Apertura DevTools → schermata hacker con ASCII art + LOCKED
 *   3. L'utente chiama  unlock("password")  nel prompt
 *   4. Corretto → tutti gli errori in coda vengono riprodotti
 *   5. Sbagliato × 3 → lockout di 30 secondi
 *   6. window.lock() → ri-blocca con schermata completa
 *
 * ─── CAMBIARE PASSWORD ────────────────────────────────────────────────
 *   1. Apri la console del browser
 *   2. Digita:  btoa('tuanuovapassword')
 *   3. Copia il risultato e sostituiscilo in _PWD_ENCODED sotto
 * ─────────────────────────────────────────────────────────────────────
 */

/* ── PASSWORD offuscata con base64 ────────────────────────────────────
   Default: "sebamollo"  →  btoa('sebamollo') === 'c2ViYW1vbGxv'      */
const _PWD_ENCODED = 'c2ViYW1vbGxv';

/* ── CONFIG ─────────────────────────────────────────────────────────── */
const MAX_ATTEMPTS    = 3;
const LOCKOUT_SECONDS = 30;
const IS_PROD         = import.meta.env.PROD;

/* ── STILI ──────────────────────────────────────────────────────────── */
const S = {
  sp:      'color:transparent;font-size:4px;background:#050302;',
  sep:     'color:rgba(240,230,211,0.12);font-size:11px;font-family:monospace;background:#050302;padding:1px 12px;',
  alert:   'color:#FF4136;font-size:13px;font-weight:900;font-family:monospace;background:#050302;padding:5px 12px;border-left:3px solid #FF4136;',
  ascii:   'color:#4AF626;font-size:11px;font-family:monospace;background:#050302;padding:0 12px;line-height:1.45;',
  brand:   'color:#F4A261;font-size:30px;font-weight:900;font-family:monospace;background:#050302;padding:8px 12px;letter-spacing:6px;',
  sys:     'color:#4AF626;font-size:11px;font-family:monospace;background:#050302;padding:2px 12px;',
  bar:     'color:#F4A261;font-size:11px;font-family:monospace;background:#050302;padding:2px 12px;',
  dim:     'color:rgba(240,230,211,0.35);font-size:11px;font-family:monospace;background:#050302;padding:2px 12px;font-style:italic;',
  locked:  'color:#F4A261;font-size:13px;font-weight:900;font-family:monospace;background:#050302;padding:5px 12px;border-left:3px solid #F4A261;',
  body:    'color:rgba(240,230,211,0.55);font-size:11px;font-family:monospace;background:#050302;padding:2px 12px;line-height:1.6;',
  prompt:  'color:#4AF626;font-size:12px;font-weight:700;font-family:monospace;background:#050302;padding:3px 12px;',
  hint:    'color:#E9C46A;font-size:11px;font-family:monospace;background:#050302;padding:2px 12px;',
  denied:  'color:#FF4136;font-size:13px;font-weight:900;font-family:monospace;background:#050302;padding:5px 12px;border-left:3px solid #FF4136;',
  lockout: 'color:#FF4136;font-size:12px;font-weight:700;font-family:monospace;background:#050302;padding:3px 12px;',
  granted: 'color:#4AF626;font-size:13px;font-weight:900;font-family:monospace;background:#050302;padding:5px 12px;border-left:3px solid #4AF626;',
  green:   'color:#4AF626;font-size:11px;font-family:monospace;background:#050302;padding:2px 12px;',
  qHead:   'color:#F4A261;font-size:11px;font-weight:700;font-family:monospace;background:#050302;padding:4px 12px;border-left:3px solid rgba(244,162,97,0.4);',
  footer:  'color:rgba(240,230,211,0.18);font-size:10px;font-family:monospace;background:#050302;padding:4px 12px;',
};

/* ── STATO ──────────────────────────────────────────────────────────── */
let isUnlocked    = false;
let attempts      = MAX_ATTEMPTS;
let lockedOut     = false;
let lockoutHandle = null;

/* ── CODA ERRORI ────────────────────────────────────────────────────── */
const _queue = [];

/* ── CONSOLE ORIGINALE (salvata prima di sovrascrivere) ─────────────── */
const _orig = {
  log:   console.log.bind(console),
  error: console.error.bind(console),
  warn:  console.warn.bind(console),
  info:  console.info.bind(console),
  debug: console.debug.bind(console),
  clear: console.clear.bind(console),
};

/* ════════════════════════════════════════════════════════════════════
   SCHERMATA PRINCIPALE — Hacker ASCII art + Lock
════════════════════════════════════════════════════════════════════ */

function printLockedScreen() {
  _orig.clear();

  /* — Riga 1: alert header — */
  _orig.log('%c ', S.sp);
  _orig.log('%c⚠  ACCESSO NON AUTORIZZATO RILEVATO', S.alert);
  _orig.log('%c─────────────────────────────────────────────────────────────────', S.sep);

  /* — ASCII art "SEBA" — */
  _orig.log('%c ', S.sp);
  _orig.log(
    '%c' +
    '  ██████  ███████ ██████   █████  \n' +
    '  ██      ██      ██   ██ ██   ██ \n' +
    '  ███████ █████   ██████  ███████ \n' +
    '       ██ ██      ██   ██ ██   ██ \n' +
    '  ██████  ███████ ██████  ██   ██ ',
    S.ascii
  );
  _orig.log('%c ', S.sp);

  /* — ASCII art "MOLLO" — */
  _orig.log(
    '%c' +
    '  ███    ███  ██████  ██      ██      ██████  \n' +
    '  ████  ████ ██    ██ ██      ██     ██    ██ \n' +
    '  ██ ████ ██ ██    ██ ██      ██     ██    ██ \n' +
    '  ██  ██  ██ ██    ██ ██      ██     ██    ██ \n' +
    '  ██      ██  ██████  ███████ ███████  ██████ ',
    S.ascii
  );

  /* — Brand name grande — */
  _orig.log('%c ', S.sp);
  _orig.log('%cSEBA MOLLO', S.brand);
  _orig.log('%c ', S.sp);

  /* — Fake system log — */
  _orig.log('%c─────────────────────────────────────────────────────────────────', S.sep);
  _orig.log('%c[SYS]  SISTEMA COMPROMESSO — BACKDOOR ATTIVA',           S.sys);
  _orig.log('%c[AUTH] OPERATORE: ██████ SEBA MOLLO ██████',             S.sys);
  _orig.log('%c[NET]  TRACCIAMENTO IP IN CORSO...',                     S.sys);
  _orig.log('%c[SCAN] ████████████████████░░░░  87% — COMPLETATO',      S.bar);
  _orig.log('%c[VULN] CVE-9999-SEBA · EXPLOIT CARICATO ✓',              S.bar);
  _orig.log('%c ', S.sp);
  _orig.log('%c  Cosa ci fai qui? Hai qualcosa di meglio da fare.',      S.dim);
  _orig.log('%c  → Se sei uno sviluppatore, sai già che non serve.',     S.dim);
  _orig.log('%c  → Se sei un curioso, bravo. Ora chiudi e dormi.',       S.dim);

  /* — Sezione LOCK — */
  _orig.log('%c ', S.sp);
  _orig.log('%c─────────────────────────────────────────────────────────────────', S.sep);
  _orig.log('%c🔐  CONSOLE PROTETTA — INSERISCI LA PASSWORD', S.locked);
  _orig.log('%c─────────────────────────────────────────────────────────────────', S.sep);
  _orig.log('%c ', S.sp);
  _orig.log('%c  Gli errori sono in quarantena — non ti perdi niente.', S.body);
  _orig.log('%c ', S.sp);
  _orig.log('%c  > unlock("???????????")', S.prompt);
  _orig.log('%c ', S.sp);
  _orig.log(`%c  ⚠  ${attempts}/${MAX_ATTEMPTS} tentativi · lockout ${LOCKOUT_SECONDS}s`, S.hint);
  _orig.log('%c ', S.sp);
  _orig.log('%c─────────────────────────────────────────────────────────────────', S.sep);
  _orig.log('%c  © SEBA MOLLO INDUSTRIES · MAXIMUM SECURITY · v3.1/2025', S.footer);
  _orig.log('%c ', S.sp);
}

/* ════════════════════════════════════════════════════════════════════
   SCHERMATE SECONDARIE
════════════════════════════════════════════════════════════════════ */

function printAccessDenied(remaining) {
  _orig.log('%c ', S.sp);
  _orig.log('%c⛔  PASSWORD ERRATA — ACCESSO NEGATO', S.denied);
  _orig.log(
    `%c  Tentativi rimasti: ${remaining}${remaining === 1 ? '  ⚠ ULTIMO TENTATIVO' : ''}`,
    remaining === 1 ? S.denied : S.hint
  );
  _orig.log('%c  Riprova:  > unlock("???????????")', S.prompt);
  _orig.log('%c ', S.sp);
}

function printLockout() {
  _orig.clear();
  _orig.log('%c ', S.sp);
  _orig.log('%c🚨  TROPPI TENTATIVI — SISTEMA BLOCCATO', S.denied);
  _orig.log(`%c  Riprova tra ${LOCKOUT_SECONDS} secondi.`, S.lockout);
  _orig.log('%c ', S.sp);

  let remaining = LOCKOUT_SECONDS;
  const tick = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(tick);
      attempts  = MAX_ATTEMPTS;
      lockedOut = false;
      printLockedScreen();
    }
  }, 1000);
}

function printAccessGranted(queueLen) {
  _orig.clear();
  _orig.log('%c ', S.sp);
  _orig.log('%c✅  ACCESSO CONCESSO', S.granted);
  _orig.log('%c  Benvenuto, Seba. Console sbloccata.', S.green);
  _orig.log('%c ', S.sp);

  if (queueLen > 0) {
    _orig.log(`%c  📦 ${queueLen} messaggio/i in coda — riproduzione:`, S.qHead);
    _orig.log('%c─────────────────────────────────────────────────────────────────', S.sep);
  } else {
    _orig.log('%c  Nessun errore in coda. Tutto pulito. 🎉', S.green);
  }
  _orig.log('%c ', S.sp);
}

function printQueueEnd(count) {
  _orig.log('%c ', S.sp);
  _orig.log('%c─────────────────────────────────────────────────────────────────', S.sep);
  _orig.log(`%c  Fine coda (${count} messaggio/i). Buon debug, Seba.`, S.footer);
  _orig.log('%c ', S.sp);
}

/* ════════════════════════════════════════════════════════════════════
   CODA — replay dopo sblocco
════════════════════════════════════════════════════════════════════ */

function replayQueue() {
  const count = _queue.length;
  if (count === 0) return;
  _queue.forEach(({ type, args }) => _orig[type]?.(...args));
  printQueueEnd(count);
  _queue.length = 0;
}

/* ════════════════════════════════════════════════════════════════════
   LOCK / RESTORE della console
════════════════════════════════════════════════════════════════════ */

function lockConsole() {
  const queue = (type) => (...args) => {
    if (!isUnlocked) _queue.push({ type, args });
    else _orig[type]?.(...args);
  };
  console.error = queue('error');
  console.warn  = queue('warn');
  console.log   = queue('log');
  console.info  = queue('info');
  console.clear = () => {}; // neutralizzato: protegge la schermata LOCKED
}

function restoreConsole() {
  console.error = _orig.error;
  console.warn  = _orig.warn;
  console.log   = _orig.log;
  console.info  = _orig.info;
  console.clear = _orig.clear;
}

if (IS_PROD) lockConsole();

/* ════════════════════════════════════════════════════════════════════
   API PUBBLICA
════════════════════════════════════════════════════════════════════ */

/** unlock("password") — digita nel prompt della console */
window.unlock = (pwd) => {
  if (lockedOut) {
    _orig.log('%c🚨  Sistema ancora bloccato. Aspetta.', S.lockout);
    return;
  }
  if (isUnlocked) {
    _orig.log('%c✅  Console già sbloccata. Usa lock() per richiuderla.', S.green);
    return;
  }

  let encoded = '';
  try { encoded = btoa(String(pwd ?? '')); } catch { /* noop */ }

  if (encoded === _PWD_ENCODED) {
    isUnlocked = true;
    attempts   = MAX_ATTEMPTS;
    restoreConsole();
    printAccessGranted(_queue.length);
    replayQueue();
  } else {
    attempts--;
    if (attempts <= 0) {
      lockedOut = true;
      attempts  = 0;
      printLockout();
      lockoutHandle = setTimeout(() => {
        lockedOut = false; attempts = MAX_ATTEMPTS; lockoutHandle = null;
      }, LOCKOUT_SECONDS * 1000);
    } else {
      printAccessDenied(attempts);
    }
  }
};

/** lock() — ri-blocca dopo lo sblocco */
window.lock = () => {
  if (!IS_PROD) {
    _orig.log('%c  [dev] lock() ignorato fuori da produzione.', S.body);
    return;
  }
  isUnlocked    = false;
  _queue.length = 0;
  lockConsole();
  printLockedScreen();
};

/* ════════════════════════════════════════════════════════════════════
   RILEVAMENTO APERTURA DEVTOOLS
════════════════════════════════════════════════════════════════════ */

if (IS_PROD) {
  let devOpen = false;
  let shown   = false;
  const THRESH = 160;

  /* Polling size-based (DevTools dockati) */
  setInterval(() => {
    const open =
      window.outerWidth  - window.innerWidth  > THRESH ||
      window.outerHeight - window.innerHeight > THRESH;

    if (open && !devOpen) {
      devOpen = true;
      if (!shown && !isUnlocked) { shown = true; setTimeout(printLockedScreen, 200); }
    } else if (!open && devOpen) {
      devOpen = false;
      shown   = false;
    }
  }, 800);

  /* toString trick — Chrome con DevTools già aperto al load */
  ;(function () {
    const img = new Image();
    let fired = false;
    Object.defineProperty(img, 'id', {
      get() {
        if (!fired && !isUnlocked) {
          fired = true;
          if (!shown) { shown = true; setTimeout(printLockedScreen, 200); }
        }
      },
    });
    requestAnimationFrame(() => { _orig.log('%c', img); });
  })();
}