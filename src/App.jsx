import { useEffect, useState, useCallback, lazy, Suspense, useRef, memo } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Preloader from './components/Preloader';
import ScrollToTop from './components/ScrollToTop';
import { TransitionLock } from './components/TransitionController';


if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

gsap.registerPlugin(ScrollTrigger);

/* ════════════════════════════════════════════════════════════════════════
   FIX JITTER MOBILE AL CAMBIO DIREZIONE DI SCROLL
   Root cause: la barra indirizzi dinamica (Chrome Android / in-app IG/FB)
   appare/scompare quando INVERTI lo scroll → evento `resize` della window →
   ScrollTrigger esegue un refresh() automatico → ricalcola pin e posizioni →
   micro-salto visibile. Lo si vede solo su mobile perché solo lì la toolbar
   è dinamica.
   ──────────────────────────────────────────────────────────────────────── */

/* [1] ignoreMobileResize — IL FIX MIRATO. ScrollTrigger ignora i resize
   causati SOLO dalla UI mobile (toolbar che si nasconde/riappare). GSAP applica
   questo flag esclusivamente quando isTouch === 1 → NON tocca il desktop. A
   livello interno salta il refresh se la larghezza non cambia e l'altezza varia
   meno del 25% (la firma tipica della barra indirizzi), ma continua a
   refreshare su un vero cambio (rotazione/resize reale). */
ScrollTrigger.config({ ignoreMobileResize: true });

/* FIX JITTER #1: Forzare il PinType su Mobile
   Di default GSAP usa `position: fixed` per le sezioni bloccate (pin).
   Il fixed su mobile "scivola" quando la barra degli indirizzi si muove.
   Forziamo i "transform" (che sono sganciati dalla UI del browser) 
   SOLO sui dispositivi touch per non interferire con Lenis su desktop. */
if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
  ScrollTrigger.defaults({ pinType: "transform" });
}

/* [2] normalizeScroll — VALUTATO e lasciato DISATTIVATO di proposito.
   normalizeScroll(true) farebbe gestire a GSAP scroll/touch su un thread
   dedicato (eliminerebbe anche i salti da resize) MA nella nostra architettura:
     · intercetta i touch → conflitto con lo scrubber a long-press della
       ScrollProgress (i nostri touchmove non-passive) e con lo scroll NATIVO
       che usiamo APPOSTA su mobile (Lenis è già disattivato sul touch);
     · può rompere position:fixed e reintrodurre latenza/jank.
   Con ignoreMobileResize il jitter è risolto senza prendere il controllo dello
   scroll. Abilitalo SOLO se, dopo i test, il salto persiste — e solo su touch,
   ricontrollando che il drag della barra e i click funzionino ancora: */
// if (window.matchMedia('(pointer: coarse)').matches) {
//   ScrollTrigger.normalizeScroll(true);
// }

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   ScrollProgress.jsx — v4 — TOUCH FREEZE DEFINITIVELY FIXED  ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ── ROOT CAUSE DEL "TOUCH FREEZE" (v3 e precedenti) ───────────────────────
 *
 * La hitbox era una striscia fixed di 44px lungo TUTTO il bordo destro con:
 *   1. touch-action: none      → il compositor cede ogni gesto a JS
 *   2. preventDefault() incondizionato sul touchstart
 *
 * Il bordo destro è esattamente dove il pollice destro inizia lo swipe.
 * Qualsiasi scroll che PARTIVA in quei 44px veniva ucciso sul nascere:
 * il dito scorreva sul vetro, la pagina restava ferma, e serviva un tap
 * fuori dalla striscia per "sbloccare". Il classico freeze segnalato.
 *
 * ── FIX v4: LONG-PRESS ENGAGE ─────────────────────────────────────────────
 *
 * Su touch il drag della barra si attiva SOLO con una pressione ferma di
 * 220ms (tolleranza 10px) — lo stesso pattern di attivazione di dnd-kit e
 * dei drag-handle iOS nativi:
 *
 *   - touch-action: pan-y sulla hitbox → lo scroll verticale nativo
 *     ATTRAVERSA liberamente la striscia. Zero intercettazioni.
 *   - touchstart: NESSUN preventDefault. Parte solo un timer.
 *   - se il dito si muove >10px prima dei 220ms → è uno swipe di scroll:
 *     il timer viene cancellato e il browser scrolla nativamente come se
 *     la hitbox non esistesse.
 *   - se il dito resta fermo 220ms → ENGAGE: solo ORA viene agganciato il
 *     touchmove non-passive su document (preventDefault efficace perché lo
 *     scroll nativo non è mai partito — il dito era fermo) e la barra
 *     diventa uno scrubber 1:1.
 *   - touchend/cancel: tutto deregistrato immediatamente.
 *
 * Risultato: scroll nativo SEMPRE libero, scrubber disponibile per chi lo
 * vuole davvero (press & hold). Il compositor non viene mai bloccato fuori
 * da un drag intenzionale.
 *
 * ── PERCHÉ TOUCH EVENTS E NON POINTER EVENTS PER IL DRAG ─────────────────
 *
 * Su Safari iOS, i Pointer Events sono implementati come wrapper sopra i
 * Touch Events nativi. Questo wrapper introduce:
 *   1. Latenza aggiuntiva (~1 frame) perché Safari risolve prima se il gesto
 *      è un "scroll inteso" o un "touch custom" prima di promuoverlo a
 *      PointerEvent.
 *   2. Il flag `passive` viene ignorato in certi contesti quando i
 *      PointerEvent vengono sollevati DOPO che il browser ha già iniziato
 *      lo scroll nativo (il cosiddetto "already started scrolling" lock).
 *
 * I Touch Events (touchstart/touchmove) invece vengono processati
 * PRIMA della decisione di scroll del browser, quindi il nostro
 * preventDefault() su { passive: false } è sempre rispettato — purché
 * venga agganciato PRIMA che lo scroll parta (garantito dal long-press:
 * il dito è fermo, lo scroll non è mai iniziato).
 *
 * ── PERCHÉ clientHeight E NON innerHeight ────────────────────────────────
 *
 * window.innerHeight include l'altezza delle UI chrome (toolbar Safari).
 * Quando l'utente scrolla e Safari nasconde la toolbar, innerHeight aumenta
 * di ~55px mid-gesture → il calcolo del ratio salta.
 * document.documentElement.clientHeight è il layout viewport, rimane
 * costante durante tutta la gesture. È la misura corretta per i calcoli
 * di posizionamento durante il drag.
 *
 * ── LENIS DETECTION ──────────────────────────────────────────────────────
 *
 * Cerca window.__lenis (naming convention di @studio-freight/lenis).
 * Se presente: lenis.scrollTo(px, { immediate: true }) → nessun conflitto.
 * Se assente: window.scrollTo con fallback per Safari < 15.4 che non
 * supporta behavior:'instant'.
 */


// ─── Tema ─────────────────────────────────────────────────────────────────────
const C = {
  green:      '#4AF626',
  greenDim:   'rgba(74,246,38,0.75)',
  greenFaint: 'rgba(74,246,38,0.07)',
  greenBorder:'rgba(74,246,38,0.15)',
  whiteDim:   'rgba(237,237,237,0.6)',
  whiteGhost: 'rgba(237,237,237,0.3)',
  font:       "'JetBrains Mono','Fira Code','Courier New',monospace",
};

// ─── Fake log pool ────────────────────────────────────────────────────────────
const LOGS = [
  'PING PYTHON_BACKEND... 200 OK',
  'FETCHING /api/scroll_state',
  'JWT_VALID: SESSION ACTIVE',
  'REDIS_CACHE: HIT 0xCACHE',
  'DB_CONN: POSTGRES:5432 OK',
  'WEBSOCKET: HEARTBEAT SENT',
  'UVICORN: WORKER #3 ALIVE',
  'CELERY: TASK_QUEUE IDLE',
  'PYDANTIC: SCHEMA VALID',
  'FASTAPI: /scroll POLLED',
  'ALEMBIC: MIGR. UP TO DATE',
  () => `GUNICORN: REQ #0x${Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4,'0')}`,
];
const randomLog = () => {
  const e = LOGS[Math.floor(Math.random() * LOGS.length)];
  return typeof e === 'function' ? e() : e;
};

// ─── Viewport helpers (stabili su Safari iOS) ─────────────────────────────────
// clientHeight = layout viewport, NON cambia quando la toolbar Safari sparisce.
const getVH    = () => document.documentElement.clientHeight;
const getTotal = () => document.documentElement.scrollHeight - getVH();

// ─── scrollTo wrapper con Lenis detection ────────────────────────────────────
const scrollToPx = (px) => {
  if (window.__lenis) {
    // immediate:true → nessuna easing, risposta 1:1 al dito
    window.__lenis.scrollTo(px, { immediate: true, duration: 0 });
    return;
  }
  try {
    // behavior:'instant' → spec moderna, Safari >= 15.4
    window.scrollTo({ top: px, behavior: 'instant' });
  } catch {
    // Fallback ultra-safe per Safari < 15.4
    window.scrollTo(0, px);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const ScrollProgress = memo(() => {

  // DOM refs — manipolazione diretta per zero re-render durante scroll/drag
  const hitboxRef   = useRef(null);
  const barRef      = useRef(null);
  const glowRef     = useRef(null);
  const textRef     = useRef(null);   // "[SYS.SCRL // 042%]"
  const logRef      = useRef(null);   // log secondario
  const timeRef     = useRef(null);   // SYS_TIME (fixed separato)

  // Stato interno
  const isDragging  = useRef(false);
  const idleTimer   = useRef(null);
  const rafClock    = useRef(null);
  const lastY       = useRef(0);

  // isActive → solo per espandere la barra visiva e spostare l'HUD
  const [isActive, setIsActive] = useState(false);
  const isActiveRef = useRef(false); // mirror senza closure stale

  const setActive = useCallback((v) => {
    isActiveRef.current = v;
    setIsActive(v);
  }, []);

  // ── Orologio ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = timeRef.current;
    if (!el) return;

    if (!isActive) {
      cancelAnimationFrame(rafClock.current);
      el.style.opacity = '0';
      return;
    }

    const tick = () => {
      const n = new Date();
      const pad = (x, l=2) => String(x).padStart(l,'0');
      el.textContent = `SYS_TIME: ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}.${pad(n.getMilliseconds(),3)}`;
      el.style.opacity = '1';
      rafClock.current = requestAnimationFrame(tick);
    };
    rafClock.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafClock.current);
      el.style.opacity = '0';
    };
  }, [isActive]);

  // ── Scroll tracker ───────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const total = getTotal();
      if (total <= 0) return;

      const raw   = window.scrollY / total;
      const pct   = Math.min(Math.max(Math.floor(raw * 100), 0), 100);
      const speed = Math.abs(window.scrollY - lastY.current);
      lastY.current = window.scrollY;

      if (textRef.current)
        textRef.current.textContent = `[SYS.SCRL // ${String(pct).padStart(3,'0')}%]`;

      if (logRef.current) {
        logRef.current.textContent  = randomLog();
        logRef.current.style.opacity = '0.65';
      }

      if (barRef.current)
        barRef.current.style.transform = `scaleY(${raw})`;

      if (glowRef.current) {
        glowRef.current.style.opacity   = String(Math.min(speed / 35, 0.85));
        glowRef.current.style.transform = `scaleY(${raw})`;
      }

      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        if (logRef.current) {
          logRef.current.textContent   = 'STATUS: IDLE_';
          logRef.current.style.opacity = '0.3';
        }
        if (glowRef.current) glowRef.current.style.opacity = '0';
      }, 200);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(idleTimer.current);
    };
  }, []);

  // ── DRAG — due sistemi paralleli, mai sovrapposti ───────────────────────
  //
  //  ┌─────────────────────┬──────────────────────────────────────────────┐
  //  │ [A] TOUCH EVENTS    │ iOS Safari / Chrome iOS                      │
  //  │ touchstart/move/end │ LONG-PRESS ENGAGE (220ms): lo swipe normale  │
  //  │                     │ attraversa la hitbox e scrolla nativamente.  │
  //  │                     │ Solo press-and-hold attiva lo scrubber.      │
  //  ├─────────────────────┼──────────────────────────────────────────────┤
  //  │ [B] POINTER EVENTS  │ Desktop mouse / trackpad                     │
  //  │ pointerdown/move/up │ Attivi SOLO se pointerType !== 'touch',      │
  //  │                     │ quindi non sparano mai su mobile.            │
  //  │                     │ setPointerCapture cattura il move fuori      │
  //  │                     │ hitbox senza bug WebKit (funziona sul mouse).│
  //  └─────────────────────┴──────────────────────────────────────────────┘
  //  I due blocchi registrano listener su eventi diversi → zero conflitti.

  // ── [A] Touch Events — mobile, LONG-PRESS ENGAGE ─────────────────────────
  useEffect(() => {
    const hitbox = hitboxRef.current;
    if (!hitbox) return;

    const HOLD_MS   = 220; // pressione ferma necessaria per agganciare il drag
    const HOLD_TOL  = 10;  // px di movimento oltre i quali è uno swipe di scroll

    let holdTimer = null;
    let startX = 0, startY = 0;
    let engaged = false;

    const applyScroll = (clientY) => {
      const ratio = Math.max(0, Math.min(1, clientY / getVH()));
      scrollToPx(ratio * getTotal());
    };

    /*
      FIX TOUCH FREEZE — ARCHITETTURA "ZERO INTERCETTAZIONE"
      ────────────────────────────────────────────────────────────────────
      PRIMA (bug): preventDefault() incondizionato sul touchstart +
      touch-action:none sulla hitbox → ogni swipe che PARTIVA nei 44px del
      bordo destro (la zona naturale del pollice) veniva cancellato →
      pagina congelata, sblocco solo con un tap fuori dalla striscia.

      ADESSO:
      1. La hitbox ha touch-action: pan-y → il pan verticale nativo passa.
      2. touchstart è { passive: true } e NON chiama mai preventDefault:
         il compositor hardware resta libero al 100%.
      3. Un monitor passive misura il movimento durante la finestra di hold:
         se il dito si sposta >10px prima dei 220ms → swipe di scroll →
         disinnesco totale, il browser non si accorge di noi.
      4. Solo a hold completato (dito FERMO 220ms → lo scroll nativo non è
         mai partito → niente "already started scrolling" lock) agganciamo
         il touchmove { passive:false } su document e lo scrubbing 1:1
         inizia. preventDefault qui è garantito da WebKit.
      5. touchend/touchcancel deregistrano tutto immediatamente.

      Il listener non-passive esiste sul document SOLO durante un drag
      intenzionale: per tutto il resto della vita della pagina il browser
      scrolla con il compositor hardware, senza consultare JS.
      ────────────────────────────────────────────────────────────────────
    */
    const onEngagedMove = (e) => {
      if (!isDragging.current) return;
      e.preventDefault(); // efficace: lo scroll nativo non è mai partito
      applyScroll(e.touches[0].clientY);
    };

    const disarmHold = () => {
      clearTimeout(holdTimer);
      holdTimer = null;
      document.removeEventListener('touchmove', onHoldMonitor, { capture: true });
    };

    const onHoldMonitor = (e) => {
      // monitor passive: misura soltanto, non blocca nulla
      const t = e.touches[0];
      if (!t) return;
      if (Math.abs(t.clientX - startX) > HOLD_TOL || Math.abs(t.clientY - startY) > HOLD_TOL) {
        // è uno swipe di scroll → disinnesco, il browser prosegue nativo
        disarmHold();
      }
    };

    const onTouchStart = (e) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      engaged = false;

      // finestra di hold: monitor passive + timer
      document.addEventListener('touchmove', onHoldMonitor, { passive: true, capture: true });
      holdTimer = setTimeout(() => {
        // dito fermo per 220ms → ENGAGE
        disarmHold();
        engaged = true;
        isDragging.current = true;
        setActive(true);
        // feedback aptico dove supportato (Android); no-op altrove
        if (navigator.vibrate) navigator.vibrate(8);
        applyScroll(startY);
        // SOLO ora il documento riceve un listener non-passive
        document.addEventListener('touchmove', onEngagedMove, { passive: false, capture: true });
      }, HOLD_MS);
    };

    const onTouchEnd = () => {
      disarmHold();
      if (engaged || isDragging.current) {
        engaged = false;
        isDragging.current = false;
        setActive(false);
        // Deregistra IMMEDIATAMENTE: libera il compositor appena il dito si alza.
        document.removeEventListener('touchmove', onEngagedMove, { capture: true });
      }
    };

    // touchstart passive: non blocchiamo MAI il gesto in partenza
    hitbox.addEventListener('touchstart',    onTouchStart, { passive: true });
    document.addEventListener('touchend',    onTouchEnd,   { passive: true });
    document.addEventListener('touchcancel', onTouchEnd,   { passive: true });

    return () => {
      hitbox.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend',    onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      // Safety net: rimuove tutto se il componente smonta durante un drag
      clearTimeout(holdTimer);
      document.removeEventListener('touchmove', onHoldMonitor, { capture: true });
      document.removeEventListener('touchmove', onEngagedMove, { capture: true });
    };
  }, [setActive]);

  // ── [B] Pointer Events — desktop mouse/trackpad ───────────────────────────
  useEffect(() => {
    const hitbox = hitboxRef.current;
    if (!hitbox) return;

    const applyScroll = (clientY) => {
      const ratio = Math.max(0, Math.min(1, clientY / getVH()));
      scrollToPx(ratio * getTotal());
    };

    const onPointerDown = (e) => {
      // Guard fondamentale: questo blocco gestisce SOLO mouse/trackpad.
      // Su mobile il browser spara sia touch che pointer events sullo stesso
      // gesto — il guard impedisce la doppia esecuzione.
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      isDragging.current = true;
      setActive(true);
      // setPointerCapture: move/up ricevuti anche fuori dall'hitbox.
      // Funziona perfettamente per mouse, nessun bug WebKit in questo caso.
      hitbox.setPointerCapture(e.pointerId);
      applyScroll(e.clientY);
    };

    const onPointerMove = (e) => {
      if (e.pointerType === 'touch' || !isDragging.current) return;
      applyScroll(e.clientY);
    };

    const onPointerUp = (e) => {
      if (e.pointerType === 'touch' || !isDragging.current) return;
      isDragging.current = false;
      setActive(false);
    };

    // Tutti sull'hitbox — setPointerCapture gestisce il fuori-hitbox
    hitbox.addEventListener('pointerdown',   onPointerDown, { passive: false });
    hitbox.addEventListener('pointermove',   onPointerMove, { passive: true  });
    hitbox.addEventListener('pointerup',     onPointerUp,   { passive: true  });
    hitbox.addEventListener('pointercancel', onPointerUp,   { passive: true  });

    return () => {
      hitbox.removeEventListener('pointerdown',   onPointerDown);
      hitbox.removeEventListener('pointermove',   onPointerMove);
      hitbox.removeEventListener('pointerup',     onPointerUp);
      hitbox.removeEventListener('pointercancel', onPointerUp);
    };
  }, [setActive]);

  // ── Hover mouse (desktop only, non interferisce con touch) ───────────────
  const onPointerEnter = useCallback((e) => {
    if (e.pointerType !== 'touch') setActive(true);
  }, [setActive]);

  const onPointerLeave = useCallback(() => {
    if (!isDragging.current) setActive(false);
  }, [setActive]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/*
        ══ HUD — STRUTTURA FLAT, ZERO FLEX ANNIDATI ══════════════════════════
        Tutti e tre i div (time, text, log) sono fixed indipendenti.
        Nessun wrapper flex condiviso → Safari non può collassarli.
        SYS_TIME si posiziona sopra gli altri tramite bottom offset.
        Il testo principale non si muove mai: layout completamente statico.
      */}

      {/* SYS_TIME — appare sopra il testo principale quando active */}
      <div
        ref={timeRef}
        style={{
          position:      'fixed',
          // SAFE-AREA: con viewport-fit=cover l'HUD fixed andrebbe sotto la barra
          // home iOS → aggiungo env(safe-area-inset-bottom) (0 dove non esiste).
          bottom:        'calc(1.5rem + 2.8rem + env(safe-area-inset-bottom, 0px))', // sopra il blocco testo
          right:         isActive ? '3.8rem' : '1.5rem',
          zIndex:        9999,
          fontFamily:    C.font,
          fontSize:      '0.52rem',
          lineHeight:    '1',
          letterSpacing: '0.06em',
          color:         C.whiteDim,
          whiteSpace:    'nowrap',
          opacity:       0,
          pointerEvents: 'none',
          userSelect:    'none',
          mixBlendMode:  'difference',
          // transition opacity gestita via ref nel clock, right via CSS
          transition:    'right 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        SYS_TIME: 00:00:00.000
      </div>

      {/* Percentuale — riga principale, non si muove mai */}
      <div
        ref={textRef}
        style={{
          position:      'fixed',
          bottom:        'calc(1.5rem + 1.4rem + env(safe-area-inset-bottom, 0px))', // sopra il log + safe-area
          right:         isActive ? '3.8rem' : '1.5rem',
          zIndex:        9999,
          fontFamily:    C.font,
          fontSize:      'clamp(0.58rem, 1.8vw, 0.65rem)',
          lineHeight:    '1',
          letterSpacing: '0.1em',
          color:         C.greenDim,
          whiteSpace:    'nowrap',
          pointerEvents: 'none',
          userSelect:    'none',
          mixBlendMode:  'difference',
          transition:    'right 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        [SYS.SCRL // 000%]
      </div>

      {/* Log secondario — riga in fondo */}
      <div
        ref={logRef}
        style={{
          position:      'fixed',
          bottom:        'calc(1.5rem + env(safe-area-inset-bottom, 0px))', // safe-area barra home
          right:         isActive ? '3.8rem' : '1.5rem',
          zIndex:        9999,
          fontFamily:    C.font,
          fontSize:      '0.5rem',
          lineHeight:    '1',
          letterSpacing: '0.05em',
          color:         C.whiteGhost,
          whiteSpace:    'nowrap',
          opacity:       0.3,
          pointerEvents: 'none',
          userSelect:    'none',
          mixBlendMode:  'difference',
          transition:    'right 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.1s ease',
        }}
      >
        STATUS: IDLE_
      </div>

      {/*
        ══ HITBOX 44px — touch target invisibile ═════════════════════════════
        FIX TOUCH FREEZE: touch-action passa da 'none' a 'pan-y'.
        'none' cedeva a JS OGNI gesto che partiva nei 44px del bordo destro
        (la zona del pollice) congelando lo scroll. Con 'pan-y' lo scroll
        verticale nativo attraversa la hitbox; il drag dello scrubber si
        attiva solo via long-press (vedi blocco [A]).
        -webkit-tap-highlight-color: transparent → rimuove il flash grigio
        su tap in Safari/Chrome iOS.
      */}
      <div
        ref={hitboxRef}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        style={{
          position:    'fixed',
          top:         0,
          right:       0,
          bottom:      0,
          width:       '44px',
          zIndex:      9998,
          cursor:      'ns-resize',
          touchAction: 'pan-y',
          WebkitTapHighlightColor: 'transparent',
          WebkitUserSelect: 'none',
          userSelect:  'none',
          display:     'flex',
          justifyContent: 'flex-end',
        }}
      >
        {/* Barra visiva — espande 4→12px, non tocca i 44px di touch area */}
        <div
          style={{
            width:      isActive ? '12px' : '4px',
            height:     '100%',
            background: C.greenFaint,
            borderLeft: `1px solid ${isActive ? 'rgba(74,246,38,0.25)' : C.greenBorder}`,
            transition: 'width 0.3s cubic-bezier(0.16,1,0.3,1), border-color 0.3s ease',
            position:   'relative',
            overflow:   'hidden',
          }}
        >
          {/* Glow velocità-scroll */}
          <div
            ref={glowRef}
            style={{
              position:        'absolute',
              top:             0,
              left:            '-8px',
              width:           '28px',
              height:          '100%',
              background:      C.green,
              filter:          'blur(7px)',
              opacity:         0,
              transformOrigin: 'top center',
              transform:       'scaleY(0)',
              willChange:      'transform, opacity',
              transition:      'opacity 0.12s ease-out',
              pointerEvents:   'none',
            }}
          />

          {/* Progress fill */}
          <div
            ref={barRef}
            style={{
              width:           '100%',
              height:          '100%',
              background:      isActive
                ? `repeating-linear-gradient(0deg,${C.green},${C.green} 2px,transparent 2px,transparent 10px)`
                : `repeating-linear-gradient(0deg,${C.green},${C.green} 3px,transparent 3px,transparent 8px)`,
              borderLeft:      isActive ? `2px solid ${C.green}` : 'none',
              transformOrigin: 'top center',
              transform:       'scaleY(0)',
              willChange:      'transform',
              pointerEvents:   'none',
              transition:      'background 0.25s ease, border 0.25s ease',
            }}
          />
        </div>
      </div>
    </>
  );
});

ScrollProgress.displayName = 'ScrollProgress';

const HeroSection    = lazy(() => import('./components/Hero/Hero'));
const Sections       = lazy(() => import('./components/AwwwardsSections'));
const ZxSpectrumPage = lazy(() => import('./pages/ZxSpectrumPage'));
const Software3DEngine = lazy(() => import('./pages/Software3DEngine'));
const ContactPage    = lazy(() => import('./pages/ContactPage'));
const ScrubbingCameraHero = lazy(() => import('./pages/ScrubbingCameraHero'));
const WorksArchive = lazy(() => import('./pages/WorksArchive'));

const SectionFallback = () => {
  return (
    <div
      aria-hidden="true"
      style={{
        /* 100dvh (non 100vh): su iOS Safari 100vh include la toolbar e
          cambia quando questa appare/scompare → il fallback risultava più
          alto della viewport reale e, alla sostituzione con la sezione
          vera, produceva un layout-shift che sporcava i bounds di Lenis.
          dvh = viewport dinamica reale, zero shift.
        */
        width: '100%',
        height: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#030201', // C.bgDeep
        zIndex: 9999,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Rumore di fondo sottile per coerenza con il resto del sito */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`
      }} />

      {/* Testo di caricamento tecnico */}
      <div style={{
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
        fontSize: '0.62rem',
        letterSpacing: '0.25em',
        color: 'rgba(244,162,97,0.7)', // Colore accent leggermente mutato
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        {/* Dot pulsante */}
        <div style={{
          width: '4px', height: '4px',
          background: '#F4A261',
          borderRadius: '50%',
          boxShadow: '0 0 8px rgba(244,162,97,0.6)',
          animation: 'fallbackPulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }} />
        [ ALLOCATING_MODULE ]
      </div>

      {/* Progress Bar Lineare Brutalista */}
      <div style={{
        width: '140px',
        height: '1px',
        background: 'rgba(244,162,97,0.1)',
        marginTop: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 0, left: 0, bottom: 0,
          width: '35%',
          background: '#F4A261',
          animation: 'fallbackScan 1.5s cubic-bezier(0.65, 0, 0.35, 1) infinite'
        }} />
      </div>

      <style>{`
        @keyframes fallbackPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.8); }
        }
        @keyframes fallbackScan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER 2 — getDocumentOffsetTop
// ─────────────────────────────────────────────────────────────────────────────
// Risale la catena offsetParent e somma tutti gli offsetTop.
// Restituisce la posizione assoluta dell'elemento nel documento in px,
// che corrisponde al valore di window.scrollY (scroll nativo) oppure
// al valore interno di lenis.scroll (virtual mode) necessario per
// portare l'elemento alla cima del viewport.
//
// PERCHÉ NON getBoundingClientRect() + window.scrollY:
//
//  ┌───────────────────┬────────────────────────────────────────────────────┐
//  │ Lenis native mode │ window.scrollY = posizione reale.                  │
//  │                   │ rect.top + window.scrollY = offsetTop ✓            │
//  ├───────────────────┼────────────────────────────────────────────────────┤
//  │ Lenis virtual mode│ window.scrollY = 0 SEMPRE.                        │
//  │ (wrapper transform│ Lenis applica transform:translateY(-Npx) al        │
//  │  su iOS)          │ wrapper. rect.top = posizione visuale ≠ lenis.scroll│
//  │                   │ → rect.top + 0 = SBAGLIATO se lenis.scroll ≠ 0.   │
//  │                   │ offsetTop traversal = posizione layout nel wrapper  │
//  │                   │ = valore corretto per lenis.scrollTo() ✓           │
//  └───────────────────┴────────────────────────────────────────────────────┘
//
// NOTA: CSS transform NON influenza offsetTop (è una proprietà di layout,
// calcolata prima delle trasformazioni). Quindi anche con il wrapper di
// Lenis che ha transform applicato, il traversal è corretto.
function getDocumentOffsetTop(el) {
  let top  = 0;
  let node = el;
  while (node && node !== document.body && node !== document.documentElement) {
    top += node.offsetTop;
    node = node.offsetParent;
  }
  return top;
}

// ─────────────────────────────────────────────────────────────────────────────
// scrollToElementWhenReady — v4 — Mobile-proof
// ─────────────────────────────────────────────────────────────────────────────
//
// ROOT CAUSE DEL BUG (storico):
//
//   In main.jsx Lenis viene deliberatamente disabilitato su touch device:
//     if (isTouchDevice) return;   ← window.__lenis rimane undefined su mobile
//
//   Il vecchio codice aveva questa condizione in DUE punti:
//     if (existingEl && window.__lenis)   ← CASO 1: non entra mai su mobile
//     if (el && window.__lenis)           ← CASO 2: non entra mai su mobile
//
//   Risultato: la Promise non risolveva MAI (o risolveva dopo 8s di timeout).
//   Il veil rimaneva nero, oppure si alzava dopo 8 secondi mostrando la hero.
//
// FIX:
//   Separare "trovare l'elemento" da "avere Lenis".
//   Su mobile si usa window.scrollTo() nativo con behavior:'instant'.
//   La condizione del MutationObserver aspetta solo l'elemento, non Lenis.
//
// PERCHÉ waitForElement + waitForStableLayout invece del "lock a 60 frame":
//
//   Il lock rAF calcolava targetY MENTRE il layout si spostava (immagini
//   lazy, font swap, GSAP pin-spacers). Su desktop il layout si stabilizza
//   in <1 frame → i 60 rAF erano tutti sulla coordinata giusta.
//   Su mobile il layout shift dura 200-600ms → i primi 40+ frame
//   calcolavano una coordinata sbagliata e ci "bloccavano" sopra.
//
//   waitForStableLayout usa ResizeObserver su document.body: risolve
//   solo quando scrollHeight non cambia per STABLE_MS ms consecutivi.
//   Una sola lettura di offsetTop sul layout stabile → una sola scrollTo.
// ─────────────────────────────────────────────────────────────────────────────

// Aspetta che document.body smetta di cambiare altezza.
// Risolve quando scrollHeight è stabile per `stableMs` ms di fila.
function waitForStableLayout(stableMs = 100, maxWait = 6000) {
  return new Promise((resolve) => {
    let timer = null;
    let done  = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      ro.disconnect();
      resolve();
    };

    const ro = new ResizeObserver(() => {
      // Ogni volta che il body cambia altezza, ripartiamo il timer.
      clearTimeout(timer);
      timer = setTimeout(finish, stableMs);
    });

    ro.observe(document.body);

    // Avvia subito: se il layout è già stabile, risolviamo in stableMs.
    timer = setTimeout(finish, stableMs);

    // Sicurezza assoluta: non bloccare oltre maxWait.
    setTimeout(finish, maxWait);
  });
}

// Astrae lo scroll finale: usa Lenis se disponibile, nativo altrimenti.
// È l'unico punto del codebase che deve sapere se Lenis esiste o no.
function scrollToY(y) {
  if (window.__lenis) {
    window.__lenis.resize(); // sincronizza bounds prima dello scroll
    window.__lenis.scrollTo(y, { immediate: true, duration: 0, force: true });
    return;
  }
  // Mobile: Lenis è disabilitato (isTouchDevice), usiamo scroll nativo.
  // behavior:'instant' è supportato da tutti i browser moderni.
  // Il try/catch copre Safari < 15.4 che non supporta l'opzione.
  try {
    window.scrollTo({ top: y, behavior: 'instant' });
  } catch {
    window.scrollTo(0, y);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// scrollToElementWhenReady — v4
// ─────────────────────────────────────────────────────────────────────────────
function scrollToElementWhenReady(id, offset = 0) {
  return new Promise((resolve) => {

    const executeScroll = async (el) => {
      // 1. Aspetta che il layout sia stabile (immagini, font, pin-spacers).
      //    Su desktop risolve in ~100ms. Su mobile aspetta quanto serve.
      await waitForStableLayout();

      // 2. Se ScrollTrigger è disponibile, forza un refresh sul layout stabile
      //    così i pin-spacer sono calcolati correttamente prima di misurare.
      if (window.__gsap) {
        const { ScrollTrigger } = await import('gsap/ScrollTrigger');
        ScrollTrigger.refresh(true);
        // Due rAF: uno per processare il refresh, uno per il paint del browser.
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      }

      // 3. Una sola lettura di offsetTop sul layout stabile → coordinata esatta.
      const targetY = getDocumentOffsetTop(el) + offset;

      // 4. Scroll unico, preciso. Lenis o nativo, a seconda del device.
      scrollToY(targetY);

      // 5. Un rAF prima di resolve: dà tempo a iOS di "accettare" la posizione
      //    prima che il veil si alzi e l'utente possa interagire.
      await new Promise(r => requestAnimationFrame(r));

      resolve();
    };

    // ── CASO 1: elemento già nel DOM ─────────────────────────────────────────
    // Nota: la condizione NON controlla window.__lenis — non serve più.
    // executeScroll usa scrollToY() che gestisce entrambi i casi.
    const existingEl = document.getElementById(id);
    if (existingEl) {
      executeScroll(existingEl);
      return;
    }

    // ── CASO 2: elemento non ancora nel DOM (Suspense sta caricando) ─────────
    // Aspettiamo solo che l'elemento esista — non Lenis.
    const observer = new MutationObserver((_, obs) => {
      const el = document.getElementById(id);
      if (el) {
        obs.disconnect();
        executeScroll(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout anti-blocco: 8s → sblocca il veil anche se qualcosa va storto.
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, 8000);
  });
}

// ── CUSTOM CURSOR GLOBALE ──────────────────────────────────────────────────
const CustomCursor = memo(() => {
  const ringRef = useRef(null), dotRef = useRef(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(hover: hover) and (pointer: fine)', () => {
      const ring = ringRef.current, dot = dotRef.current;
      gsap.set([ring, dot], { xPercent: -50, yPercent: -50 }); // Opacity è già 0 nel CSS inline

      const rX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3.out' });
      const rY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3.out' });
      const dX = gsap.quickTo(dot, 'x', { duration: 0.07 });
      const dY = gsap.quickTo(dot, 'y', { duration: 0.07 });

      let visible = false;
      let isHiddenBySection = false; // Flag per capire se siamo nella WorkSection

      const onMove = (e) => {
        // 1. Controlla se il cursore si trova sopra la WorkSection
        if (e.target.closest('.work-section')) {
          if (!isHiddenBySection) {
            gsap.to([ring, dot], { opacity: 0, duration: 0.2 });
            isHiddenBySection = true;
            visible = false;
          }
        } else {
          // 2. Se non siamo nella WorkSection, mostralo normalmente
          if (isHiddenBySection) isHiddenBySection = false;
          if (!visible) {
            gsap.to([ring, dot], { opacity: 1, duration: 0.35 });
            visible = true;
          }
        }

        // 3. Muovi il cursore solo se non è nascosto (risparmia CPU)
        if (!isHiddenBySection) {
          rX(e.clientX); rY(e.clientY); dX(e.clientX); dY(e.clientY);
        }
      };

      window.addEventListener('mousemove', onMove);
      return () => window.removeEventListener('mousemove', onMove);
    });
    return () => mm.revert();
  }, []);

  return (
    <>
      <div ref={ringRef} style={{ position: 'fixed', top: 0, left: 0, width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(240,230,211,0.32)', pointerEvents: 'none', zIndex: 9999, mixBlendMode: 'difference', willChange: 'transform', opacity: 0 }} />
      <div ref={dotRef} style={{ position: 'fixed', top: 0, left: 0, width: 5, height: 5, borderRadius: '50%', background: '#F4A261', pointerEvents: 'none', zIndex: 9999, willChange: 'transform', opacity: 0 }} />
    </>
  );
});

/* PERF FIX: rimosso 'handleRouteChange' — era dead code, definito ma MAI
   referenziato (né nelle Routes né altrove). Eliminarlo non cambia nulla a
   runtime e tiene il modulo più snello. */

/* PERF FIX: stile statico di <main> hoisted a costante di modulo. Prima era un
   oggetto inline ricreato ad ogni render di App → nuovo riferimento → React
   ri-diffava/riapplicava lo style sul nodo <main>. Ora è un oggetto stabile e
   condiviso (stessi identici valori → ZERO modifica al design). */
/* FULL-BLEED FIX: 100svh (small viewport height) invece di 100dvh. dvh CAMBIA
   quando la toolbar mobile si nasconde → reflow/jank durante lo scroll; svh è
   STABILE e riempie comunque la viewport visibile. Lo sfondo scuro di html/body
   (in index.css) copre ogni pixel residuo → nessuna banda bianca. */
const MAIN_STYLE = { backgroundColor: '#020202', color: '#F0E6D3', minHeight: '100svh' };

const HomePage = () => {
  const location = useLocation();
  const veilRef = useRef(null);

  useEffect(() => {
    // Determine the target ID. It checks for both `scrollTo` and our new `scrollToWorks`
    const targetId = location.state?.scrollTo ?? (location.state?.scrollToWorks ? 'sezione-lavori' : null);

    if (targetId) {
      scrollToElementWhenReady(targetId).then(() => {
        // Final guard before the veil lifts
        if (window.__lenis) {
          const el = document.getElementById(targetId);
          if (el) {
            let top = 0, node = el;
            while (node && node !== document.body && node !== document.documentElement) {
              top += node.offsetTop;
              node = node.offsetParent;
            }
            window.__lenis.scrollTo(top, { immediate: true, duration: 0 });
          }
        }

        if (veilRef.current) {
          gsap.to(veilRef.current, {
            scaleY: 0,
            transformOrigin: 'bottom',
            duration: 1,
            ease: 'expo.inOut',
          });
        }
      });
      // Clear the history state after triggering the scroll so it doesn't re-trigger on reload
      window.history.replaceState({}, document.title);
    } else {
      if (veilRef.current) {
        gsap.set(veilRef.current, { scaleY: 0 });
      }
      requestAnimationFrame(() => {
        if (window.__lenis) {
          window.__lenis.scrollTo(0, { immediate: true, duration: 0 });
        }
      });
    }
  }, [location]); // We listen to the location object directly

  return (
    <>
      <div
        ref={veilRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: '#030201',
          zIndex: 9999,
          pointerEvents: 'none',
          transform: (location.state?.scrollTo || location.state?.scrollToWorks) ? 'scaleY(1)' : 'scaleY(0)',
          willChange: 'transform'
        }}
      />

      <Suspense fallback={<SectionFallback />}><HeroSection /></Suspense>
      <Suspense fallback={<SectionFallback />}><Sections /></Suspense>
    </>
  );
};

export default function App() {
  // ── FIX 1 — DISABILITA SCROLL RESTORATION NATIVA ────────────────────────────
  // Il browser salva e ripristina automaticamente la posizione di scroll
  // quando l'utente naviga avanti/indietro nella history. Questo comportamento
  // crea una race condition fatale con Lenis:
  //   1. L'utente va su /projects/xyz (scroll = 0)
  //   2. Torna su / → il browser ripristina l'ultimo scrollY della Home
  //   3. Lenis prova a impostare la posizione target (es. #sezione-lavori)
  //   4. Browser e Lenis si sovrascrivono a vicenda → "salto" visivo.
  //
  // Con 'manual' cediamo il controllo COMPLETO a Lenis/ScrollTrigger,
  // che è l'unica sorgente di verità per la posizione di scroll.
  // L'assegnazione è idempotente → sicuro anche con React StrictMode
  // che in dev esegue gli effects due volte.
  // Skip preloader for any route other than '/'.
  const [preloaderDone, setPreloaderDone] = useState(
    () => window.location.pathname !== '/'
  );

  useEffect(() => {
    // ── Lock scroll during preloader so the user can't scroll the blank
    // background on mobile while assets are loading.
    // NOTA (direttiva "scroll mobile"): questo lock è TEMPORANEO e scoped al
    // solo preloader (rotta '/'). Viene SEMPRE rimosso dalla cleanup qui sotto
    // appena preloaderDone passa a true → nessun freeze permanente del touch.
    if (!preloaderDone) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }

    // Preloader just finished: recalibrate all triggers now that the full
    // page is visible and layout is stable. Two delayed refreshes handle
    // any lazy-loaded sections that paint after the first recalc.
    // (Il ResizeObserver globale in main.jsx copre tutti i casi successivi.)
    // Primo refresh: il layout è appena diventato visibile e l'utente non sta
    // ancora scrollando → sicuro, nessun salto.
    ScrollTrigger.refresh();

    /* REFRESH RITARDATI "SCROLL-SAFE" — le sezioni lazy dipingono dopo, quindi
       servono ancora i refresh a 500/1500ms. PROBLEMA: se partono MENTRE
       l'utente sta scrollando, strappano la pagina (il salto che vogliamo
       evitare). SOLUZIONE: un flag isScrolling; finché è attivo il refresh
       viene RIMANDATO (riprovato ogni 200ms) e parte solo quando lo scroll è
       fermo da ~150ms → il ricalcolo non avviene MAI durante un gesto. */
    let isScrolling = false;
    let idleTimer;
    let retryTimer;
    const onScrollMark = () => {
      isScrolling = true;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { isScrolling = false; }, 150);
    };
    window.addEventListener('scroll', onScrollMark, { passive: true });

    const safeRefresh = () => {
      if (isScrolling) {
        retryTimer = setTimeout(safeRefresh, 200); // utente in scroll → rimanda
        return;
      }
      ScrollTrigger.refresh();
    };
    const id1 = setTimeout(safeRefresh,  500);
    const id2 = setTimeout(safeRefresh, 1500);

    return () => {
      clearTimeout(id1);
      clearTimeout(id2);
      clearTimeout(idleTimer);
      clearTimeout(retryTimer);
      window.removeEventListener('scroll', onScrollMark);
    };
  }, [preloaderDone]);

  /* PERF FIX: useCallback → riferimento STABILE passato a <Preloader>. Senza,
     ogni render di App creerebbe una nuova funzione e, dato che Preloader può
     essere memoizzato, ne forzerebbe un re-render inutile. Deps vuote: la
     funzione non dipende da nulla. */
  const handlePreloaderComplete = useCallback(() => setPreloaderDone(true), []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <TransitionLock />
      <CustomCursor />
      {!preloaderDone && <Preloader onComplete={handlePreloaderComplete} />}
      {preloaderDone && <ScrollProgress />}
      <main style={MAIN_STYLE}>
        <Routes>
          <Route
            path="/"
            element={<HomePage key={location.pathname} />}
          />
          <Route
            path="/projects/zx-spectrum"
            element={<Suspense fallback={<SectionFallback />}><ZxSpectrumPage /></Suspense>}
          />
          <Route
            path="/projects/software-3d-engine"
            element={<Suspense fallback={<SectionFallback />}><Software3DEngine /></Suspense>}
          />
          <Route
            path="/contact"
            element={<Suspense fallback={<SectionFallback />}><ContactPage /></Suspense>}
          />
          <Route
            path="/projects/aeon-camera"
            element={<Suspense fallback={<SectionFallback />}><ScrubbingCameraHero /></Suspense>}
          />
          <Route
            path="/works"
            element={<Suspense fallback={<SectionFallback />}><WorksArchive /></Suspense>}
          />
        </Routes>

      </main>
      <style>{`
        @keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @media (max-width: 767px) { .hide-mobile { display: none !important; } }
      `}</style>
    </BrowserRouter>
  );
}