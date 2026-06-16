/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  TECH STACK — Physics Pills (REFACTORED / PRODUCTION — BULLETPROOF)
 *
 *  Questa revisione mantiene tutte le ottimizzazioni della versione precedente
 *  (DOM sync su `afterUpdate` invece di un rAF parallelo, sleeping bodies,
 *  pausa off-screen, audio throttled, spotlight con quickTo) e aggiunge uno
 *  strato di robustezza "production-grade":
 *
 *  FIX 1 — DISAPPEARING PILLS (CRITICO)
 *    · Re-entry heal: quando la sezione rientra nel viewport, prima di
 *      riavviare il Runner ri-misuriamo il container, riposizioniamo i muri e
 *      RI-CLAMPIAMO ogni pillola dentro i limiti correnti (azzerando la
 *      velocità). Cura qualsiasi deriva avvenuta mentre la fisica era in pausa.
 *    · Safety-net heartbeat: un controllo throttlato (~ogni 400ms, dentro
 *      `afterUpdate`) intercetta le pillole finite nel vuoto (y > height+200),
 *      sopra il soffitto sigillato o oltre i muri, e le fa RESPAWNARE in alto
 *      DENTRO la scatola.
 *
 *  FIX 2 — applyBounds a prova di proiettile
 *    · Guard su dimensioni 0/NaN: una callback ResizeObserver "vuota" (0×0,
 *      comune durante reflow mobile / barra URL) NON collassa più tutti i muri
 *      sull'origine teletrasportando le pillole a (-36,-36) → era LA causa
 *      principale della loro sparizione sopra il soffitto sigillato.
 *    · Clamp width-aware: l'asse X usa la mezza-larghezza REALE di ogni pillola
 *      (non PILL_R), così le pillole larghe non restano incastrate nei muri.
 *
 *  FIX 3 — Runner timing reset (Matter 0.20)
 *    · Al rientro / ritorno tab azzeriamo `timeLastTick`, `timeBuffer` e lo
 *      storico frame-delta: il primo tick dopo una lunga pausa usa il
 *      frame-delta di fallback invece di "recuperare" l'intera durata in un
 *      colpo solo (niente tunneling attraverso i muri).
 *
 *  FIX 4 — Audio iOS/Safari safe
 *    · init + resume in try/catch, sblocco al primo gesto utente, bail
 *      silenzioso se il context non è "running": l'audio non può MAI rompere
 *      la simulazione fisica.
 *
 *  FIX 5 — Wheel/scroll + cleanup ermetico
 *    · In Matter 0.20 il Mouse registra l'evento `wheel` (con preventDefault):
 *      la vecchia rimozione di `mousewheel`/`DOMMouseScroll` era un no-op e il
 *      container BLOCCAVA lo scroll di pagina. Ora rimuoviamo `wheel`.
 *    · Tutti gli observer/listener/timer/GSAP vengono smontati: zero leak.
 *
 *  deps: npm i matter-js gsap
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useCallback } from 'react';
import Matter from 'matter-js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ─────────────────────────────────────────────
   CONFIG  (design tokens INVARIATI)
───────────────────────────────────────────── */
const PILLS = [
  { label: 'Python',      w: 130, bg: 'rgb(7, 19, 249)' },
  { label: 'React',       w: 120, bg: 'rgba(209, 5, 195, 0.77)' },
  { label: 'GSAP',        w: 110, bg: 'rgba(255, 255, 22, 0.12)' },
  { label: 'CSS / SCSS',  w: 150, bg: 'rgba(255,255,255,0.08)' },
  { label: 'JavaScript',  w: 150, bg: 'rgb(139, 125, 30)' },
  { label: 'TypeScript',  w: 150, bg: 'rgba(49,120,198,0.12)' },
  { label: 'Next.js',     w: 130, bg: 'rgba(255,255,255,0.12)' },
  { label: 'Tailwind',    w: 140, bg: 'rgba(1, 61, 7, 0.86)' },
  { label: 'Node.js',     w: 130, bg: 'rgba(104,160,99,0.12)' },
  { label: 'PostgreSQL',  w: 160, bg: 'rgba(51,103,145,0.12)' },
  { label: 'C / C++',     w: 120, bg: 'rgba(78, 17, 99, 0.89)' },
  { label: 'AI',          w: 100, bg: 'rgb(227, 92, 14)' },
  { label: 'FastAPI',     w: 130, bg: 'rgba(0,150,136,0.12)' },
  { label: 'Spline',      w: 120, bg: 'rgb(255, 0, 238)' },
  { label: 'MatLab',      w: 130, bg: 'rgb(0, 179, 255)' },
];

const PILL_H = 56;
const PILL_R = PILL_H / 2;
const WALL_THICKNESS = 80;
const WALL_LENGTH = 6000; // oversized: il resize richiede solo setPosition
const GRAVITY_Y = 0.85;

const C = {
  bgDeep: '#030201',
  text: '#F0E6D3',
  accent: '#F4A261',
};

/* ─────────────────────────────────────────────
   AUDIO ENGINE (modulo singleton)
   · niente window globals
   · master gain + compressor anti-clipping
   · limite voci simultanee
   · iOS/Safari SAFE: init/resume in try/catch, sblocco al primo gesto
     utente, e — soprattutto — non lancia MAI eccezioni nel loop fisico.
───────────────────────────────────────────── */
const AudioEngine = (() => {
  let ctx = null;
  let master = null;
  let voices = 0;
  let initFailed = false;          // se l'AudioContext non è creabile, smetti di riprovare
  const MAX_VOICES = 5;

  // Crea il grafo audio una sola volta. Tutto in try/catch: su browser senza
  // Web Audio (o con policy restrittive) ritorna null e la fisica continua.
  const ensure = () => {
    if (ctx || initFailed) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { initFailed = true; return null; }
      ctx = new AC();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 6;
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(compressor);
      compressor.connect(ctx.destination);
    } catch (err) {
      // Init fallito (es. Safari in stato esotico): disattiva l'audio per sempre.
      initFailed = true;
      ctx = null;
      master = null;
      return null;
    }
    return ctx;
  };

  // Va chiamata da un VERO gesto utente (pointerdown/touchstart/click/keydown)
  // per soddisfare le autoplay policy di Safari/iOS/Chrome. Ripetibile a costo zero.
  const unlock = () => {
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') {
      // `resume()` ritorna una Promise che può rifiutare: la inghiottiamo.
      c.resume().catch(() => {});
    }
  };

  const play = (velocity) => {
    // L'intero metodo è blindato: qualunque errore audio NON deve propagarsi
    // dentro il callback di collisione di Matter (romperebbe la simulazione).
    try {
      const c = ensure();
      if (!c || voices >= MAX_VOICES) return;

      // Se il context non è ancora "running" (nessun gesto utente su iOS),
      // tentiamo un resume opportunistico ma NON suoniamo questo impatto.
      if (c.state !== 'running') {
        if (c.state === 'suspended') c.resume().catch(() => {});
        return;
      }

      voices += 1;

      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(master);

      const vol = Math.min(velocity / 30, 0.3);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300 + velocity * 15, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.05);
      // exponentialRamp non accetta 0: clamp di sicurezza sul valore iniziale.
      gain.gain.setValueAtTime(Math.max(vol, 0.0001), c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);

      osc.onended = () => {
        voices = Math.max(0, voices - 1);
        try { osc.disconnect(); gain.disconnect(); } catch (_) { /* già scollegati */ }
      };
      osc.start();
      osc.stop(c.currentTime + 0.06);
    } catch (err) {
      // Recupera la "voce" se l'avevamo conteggiata, poi ignora.
      voices = Math.max(0, voices - 1);
    }
  };

  return { play, unlock };
})();

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
export default function TechStack() {
  const containerRef = useRef(null);
  const spotlightRef = useRef(null);
  const engineRef = useRef(null);
  const pillRefs = useRef([]);
  const chaosRestoreRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const spotlight = spotlightRef.current;
    if (!container || !spotlight) return;

    const { Engine, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Events, Sleeping } = Matter;

    /* ── ENGINE + SLEEPING ─────────────────── */
    const engine = Engine.create({
      enableSleeping: true, // dormienza: i corpi fermi escono dal solver
      positionIterations: 6,
      velocityIterations: 4,
    });
    engineRef.current = engine;
    engine.gravity.y = GRAVITY_Y;

    // Dimensioni "vive" della scena: aggiornate da applyBounds ad ogni resize.
    let width = container.clientWidth;
    let height = container.clientHeight;

    /* ── MURI (oversized → resize = solo setPosition) ── */
    const wallOptions = {
      isStatic: true,
      friction: 0.3,
      restitution: 0.2,
      render: { visible: false },
    };
    const ground    = Bodies.rectangle(width / 2, height + WALL_THICKNESS / 2, WALL_LENGTH, WALL_THICKNESS, wallOptions);
    const leftWall  = Bodies.rectangle(-WALL_THICKNESS / 2, height / 2, WALL_THICKNESS, WALL_LENGTH, wallOptions);
    const rightWall = Bodies.rectangle(width + WALL_THICKNESS / 2, height / 2, WALL_THICKNESS, WALL_LENGTH, wallOptions);
    // Soffitto "fantasma" finché le pillole piovono, poi sigillato.
    const ceiling   = Bodies.rectangle(width / 2, -WALL_THICKNESS / 2, WALL_LENGTH, WALL_THICKNESS, { ...wallOptions, isSensor: true });
    Composite.add(engine.world, [ground, leftWall, rightWall, ceiling]);

    // Stato di "tenuta" del soffitto: governa il clamp dall'alto e l'heartbeat.
    let ceilingSealed = false;

    /* ── PILLOLE ───────────────────────────── */
    // chamfer.quality basso = meno vertici = collisioni più economiche.
    // Create una sola volta e riutilizzate per tutta la vita del componente
    // (pooling: mai distrutte/ricreate, nemmeno al resize).
    const pillBodies = PILLS.map((pill, i) => {
      const startX = width / 2 + (Math.random() - 0.5) * (width * 0.4);
      const startY = -150 - Math.random() * 400;
      return Bodies.rectangle(startX, startY, pill.w, PILL_H, {
        chamfer: { radius: PILL_R, quality: 4 },
        restitution: 0.35,
        friction: 0.2,
        density: 0.002,
        angle: (Math.random() - 0.5) * 0.5,
        label: `pill-${i}`,
        sleepThreshold: 45, // si addormentano un filo prima del default (60)
      });
    });
    const halfWidths = PILLS.map((p) => p.w / 2);

    /* ── MOUSE CONSTRAINT ──────────────────── */
    const mouse = Mouse.create(container);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    });
    Composite.add(engine.world, mouseConstraint);
    // FIX 5: in Matter 0.20 il Mouse aggancia l'evento `wheel` (passive:false +
    // preventDefault). Rimuovendolo, lo scroll della PAGINA non viene più
    // bloccato quando il cursore è sopra il container. (`mousewheel`/
    // `DOMMouseScroll` sono retaggi: removeEventListener su handler inesistenti
    // è un no-op innocuo, li teniamo per compat con build più vecchie.)
    mouse.element.removeEventListener('wheel', mouse.mousewheel);
    mouse.element.removeEventListener('mousewheel', mouse.mousewheel);
    mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel);

    // rect cachato per lo spotlight (niente layout-read per ogni mousemove).
    let rect = container.getBoundingClientRect();
    const refreshRect = () => { rect = container.getBoundingClientRect(); };

    /* ── STATE DEL SYNC DOM ──────────────────
       Dichiarati qui in alto perché helper come respawnAtTop/applyBounds
       impostano `forceSync` per forzare un riallineamento DOM al tick seguente. */
    const lastState = PILLS.map(() => ({ x: NaN, y: NaN, a: NaN }));
    let forceSync = false;

    /* ── BOUNDS HELPERS (cuore del fix anti-sparizione) ─────────────────── */

    // Riporta UN corpo dentro i limiti correnti, width-aware sull'asse X.
    // Ritorna true se l'ha spostato. Solo i corpi fuori limite vengono toccati:
    // la pila a riposo resta intatta (le pillole in-bounds non vengono mosse).
    const clampBodyInside = (body, i) => {
      const hw = halfWidths[i];
      const minX = hw + 4;
      const maxX = Math.max(minX, width - hw - 4);
      const maxY = Math.max(PILL_R + 4, height - PILL_R - 4);
      // Dall'alto clampiamo SOLO a soffitto sigillato: durante la pioggia
      // iniziale le pillole sono legittimamente sopra il container.
      const minY = ceilingSealed ? PILL_R + 4 : -Infinity;

      const x = body.position.x;
      const y = body.position.y;
      const nx = Math.min(Math.max(x, minX), maxX);
      const ny = Math.min(Math.max(y, minY), maxY);

      if (nx !== x || ny !== y) {
        Sleeping.set(body, false);                 // un corpo dormiente ignora setPosition: sveglialo
        Body.setPosition(body, { x: nx, y: ny });  // teletrasporto dentro i limiti
        Body.setVelocity(body, { x: 0, y: 0 });    // azzera la velocità residua
        Body.setAngularVelocity(body, 0);
        return true;
      }
      return false;
    };

    // Respawn DENTRO la scatola, appena sotto il bordo superiore: valido anche
    // a soffitto sigillato (non resta incastrato sopra il coperchio).
    const respawnAtTop = (body, i) => {
      Sleeping.set(body, false);
      const hw = halfWidths[i];
      const margin = hw + 6;
      const span = Math.max(1, width - margin * 2);
      const x = margin + Math.random() * span;
      const y = PILL_R + 12; // top della pillola ≈ 12-28px sotto y=0 → ben dentro
      Body.setPosition(body, { x, y });
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
      Body.setAngle(body, 0);
      forceSync = true;
    };

    // FIX 2: applyBounds a prova di proiettile. Riposiziona i muri (oversized →
    // basta setPosition) e riporta dentro tutte le pillole. La GUARD su w/h è
    // ciò che impedisce a una callback ResizeObserver "vuota" (0×0) di
    // collassare i muri sull'origine e teletrasportare le pillole fuori scena.
    const applyBounds = (w, h) => {
      if (!(w > 0) || !(h > 0)) return; // dimensioni non valide → non toccare il mondo

      width = w;
      height = h;
      Body.setPosition(ground,    { x: w / 2, y: h + WALL_THICKNESS / 2 });
      Body.setPosition(ceiling,   { x: w / 2, y: -WALL_THICKNESS / 2 });
      Body.setPosition(leftWall,  { x: -WALL_THICKNESS / 2, y: h / 2 });
      Body.setPosition(rightWall, { x: w + WALL_THICKNESS / 2, y: h / 2 });

      for (let i = 0; i < pillBodies.length; i++) {
        const body = pillBodies[i];
        if (!body.plugin.spawned) continue;   // ignora le pillole non ancora "piovute"
        clampBodyInside(body, i);
      }
      forceSync = true;
      refreshRect();
    };

    // FIX 3: reset del time-keeping del Runner. Dopo una lunga pausa off-screen
    // o un throttling della tab, il primo tick userebbe un frame-delta enorme.
    // Azzerando questi campi (Matter 0.20: timeLastTick/timeBuffer/
    // frameDeltaHistory; legacy <=0.19: timePrev/deltaHistory) il motore riparte
    // pulito invece di "recuperare" l'intera pausa in un colpo → niente tunneling.
    const resetRunnerTiming = () => {
      runner.timeLastTick = null;
      runner.timeBuffer = 0;
      if (Array.isArray(runner.frameDeltaHistory)) runner.frameDeltaHistory.length = 0;
      if ('timePrev' in runner) runner.timePrev = null;
      if (Array.isArray(runner.deltaHistory)) runner.deltaHistory.length = 0;
    };

    /* ── SYNC DOM (sostituisce il rAF loop) ──
       Una passata per tick fisico, agganciata a `afterUpdate`. Dirty-check
       per-body + skip dei corpi in sleeping: a riposo non scrive nulla. Solo
       transform (compositor), nessuna proprietà layout-triggering.            */
    const syncDOM = () => {
      const force = forceSync;
      forceSync = false;
      for (let i = 0; i < pillBodies.length; i++) {
        const body = pillBodies[i];
        if (!force && body.isSleeping) continue;
        const el = pillRefs.current[i];
        if (!el) continue;
        const { x, y } = body.position;
        const a = body.angle;
        const last = lastState[i];
        if (
          !force &&
          Math.abs(x - last.x) < 0.05 &&
          Math.abs(y - last.y) < 0.05 &&
          Math.abs(a - last.a) < 0.001
        ) continue;
        last.x = x; last.y = y; last.a = a;
        el.style.transform =
          `translate3d(${x - halfWidths[i]}px, ${y - PILL_R}px, 0) rotate(${a}rad)`;
      }
    };

    // FIX 1 (safety net): heartbeat throttlato dentro afterUpdate. Intercetta le
    // pillole "perse" — cadute nel vuoto sotto il pavimento (scroll/throttle
    // violenti), sfuggite sopra il soffitto sigillato o oltre i muri — e le fa
    // respawnare in alto dentro la scatola. ~Ogni 400ms: costo trascurabile.
    let lastBoundsCheck = 0;
    const BOUNDS_CHECK_MS = 400;
    const VOID_MARGIN = 200; // px oltre il limite = considerata "persa"

    const boundsCheck = (now) => {
      if (now - lastBoundsCheck < BOUNDS_CHECK_MS) return;
      lastBoundsCheck = now;
      for (let i = 0; i < pillBodies.length; i++) {
        const body = pillBodies[i];
        if (!body.plugin.spawned) continue;
        const hw = halfWidths[i];
        const x = body.position.x;
        const y = body.position.y;
        const fellIntoVoid = y > height + VOID_MARGIN;          // sotto/oltre il pavimento
        const escapedAbove = ceilingSealed && y < -VOID_MARGIN; // sopra un coperchio chiuso
        const escapedSide  = x < -hw - 120 || x > width + hw + 120; // oltre un muro
        if (fellIntoVoid || escapedAbove || escapedSide) {
          respawnAtTop(body, i);
        }
      }
    };

    // afterUpdate: prima la rete di sicurezza, poi il sync DOM.
    const onAfterUpdate = () => {
      boundsCheck(performance.now());
      syncDOM();
    };
    Events.on(engine, 'afterUpdate', onAfterUpdate);

    /* ── COLLISION AUDIO (throttled) ─────────
       · gap globale: max ~16 suoni/secondo
       · cooldown per-body: la stessa pillola non "clacca" più di ~7 volte/sec
       · max 1 suono per tick fisico
       · AudioEngine.play è blindato: non può rompere la fisica.                */
    const SOUND_GLOBAL_GAP = 60;  // ms
    const SOUND_BODY_GAP = 140;   // ms
    const MIN_IMPACT = 2.5;
    let lastGlobalSoundAt = 0;
    const bodyCooldowns = new Map();

    const onCollisionStart = (event) => {
      const now = performance.now();
      if (now - lastGlobalSoundAt < SOUND_GLOBAL_GAP) return;
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        if (bodyA.isStatic && bodyB.isStatic) continue;
        if (bodyA.isSleeping && bodyB.isSleeping) continue;
        const impact = (bodyA.speed || 0) + (bodyB.speed || 0);
        if (impact < MIN_IMPACT) continue;
        const lastA = bodyCooldowns.get(bodyA.id) || 0;
        const lastB = bodyCooldowns.get(bodyB.id) || 0;
        if (now - lastA < SOUND_BODY_GAP || now - lastB < SOUND_BODY_GAP) continue;
        bodyCooldowns.set(bodyA.id, now);
        bodyCooldowns.set(bodyB.id, now);
        lastGlobalSoundAt = now;
        AudioEngine.play(impact);
        break; // un solo suono per tick: niente raffiche
      }
    };
    Events.on(engine, 'collisionStart', onCollisionStart);

    /* ── RUNNER + PAUSA OFF-SCREEN ─────────── */
    const runner = Runner.create();
    Runner.run(runner, engine);

    // FIX 1 (re-entry heal): all'uscita dal viewport il Runner si ferma; al
    // rientro, PRIMA di riavviarlo, ri-misuriamo il container, riposizioniamo i
    // muri e ri-clampiamo ogni pillola (applyBounds), e azzeriamo il timing del
    // Runner. Così qualsiasi deriva accumulata in pausa (resize barra-URL,
    // rotazione, throttle) viene sanata e la fisica riparte pulita e in-bounds.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const w = container.clientWidth;
          const h = container.clientHeight;
          if (w > 0 && h > 0) applyBounds(w, h); // muri + clamp + forceSync
          resetRunnerTiming();                   // niente catch-up burst
          runner.enabled = true;
        } else {
          runner.enabled = false;                // fisica a costo ~zero fuori schermo
        }
      },
      { rootMargin: '100px' }
    );
    io.observe(container);

    /* ── SPOTLIGHT (quickTo + rect cachato) ──
       xPercent/yPercent gestiscono la centratura, così i quickTo su x/y non la
       sovrascrivono (bug della versione CSS translate(-50%,-50%)).            */
    gsap.set(spotlight, { xPercent: -50, yPercent: -50, opacity: 0 });
    const spotX = gsap.quickTo(spotlight, 'x', { duration: 0.4, ease: 'power2.out' });
    const spotY = gsap.quickTo(spotlight, 'y', { duration: 0.4, ease: 'power2.out' });
    const spotO = gsap.quickTo(spotlight, 'opacity', { duration: 0.35, ease: 'power2.out' });

    const onPointerEnter = () => refreshRect();
    const onPointerMove = (e) => {
      spotX(e.clientX - rect.left);
      spotY(e.clientY - rect.top);
      spotO(1);
    };
    const onPointerLeave = () => spotO(0);
    const onScroll = () => refreshRect();

    container.addEventListener('pointerenter', onPointerEnter);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('scroll', onScroll, { passive: true });

    /* ── RESPONSIVE SCALING (senza ricreare il mondo) ──
       Debounce su rAF + applyBounds blindato. Su rotazione/resize aggressivi i
       muri si riposizionano e le pillole restano dentro; a soffitto sigillato
       il clamp è completo (anche dall'alto) → nessuna fuga durante il resize.  */
    let resizeRaf = 0;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0] && entries[0].contentRect;
      if (!cr) return;
      const w = cr.width;
      const h = cr.height;
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => applyBounds(w, h)); // guard interna su 0×0
    });
    ro.observe(container);

    /* ── ENTRY TRIGGER (GSAP context) ────────
       Le delayedCalls sostituiscono i setTimeout orfani: registrate nel context
       via ctx.add, quindi ctx.revert() le uccide all'unmount. Niente race
       condition su mondo distrutto.                                           */
    const gsapCtx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: container,
        start: 'top 70%',
        once: true,
        onEnter: () => {
          gsapCtx.add(() => {
            pillBodies.forEach((body, i) => {
              gsap.delayedCall(i * 0.06, () => {
                body.plugin.spawned = true;
                Composite.add(engine.world, body);
              });
            });
            // Sigilla la scatola: in antigravità non scappano dal soffitto.
            // ceilingSealed attiva anche il clamp-dall'alto e il check "escapedAbove".
            gsap.delayedCall(2, () => {
              ceiling.isSensor = false;
              ceilingSealed = true;
            });
          });
        },
      });
    }, container);

    /* ── GRAVITY SENSOR (solo touch device) ── */
    const isCoarsePointer =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;

    let lastGravityX = 0;
    const handleOrientation = (e) => {
      const gamma = e.gamma || 0;
      const forceX = Math.max(-1, Math.min(1, gamma / 45));
      if (Math.abs(forceX - lastGravityX) < 0.02) return; // dead-zone anti-jitter
      lastGravityX = forceX;
      engine.gravity.x = forceX;
    };
    if (isCoarsePointer) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    /* ── AUDIO UNLOCK (iOS/Safari) ───────────
       Il primo gesto utente sblocca l'AudioContext. once:true si auto-rimuove
       al primo fire; la rimozione in cleanup copre il caso "mai scattato".    */
    const unlockAudio = () => AudioEngine.unlock();
    const unlockEvents = ['pointerdown', 'touchstart', 'mousedown', 'keydown'];
    unlockEvents.forEach((ev) =>
      window.addEventListener(ev, unlockAudio, { once: true, passive: true })
    );

    /* ── VISIBILITYCHANGE (tab throttling) ───
       Tornando visibile la tab, azzeriamo il timing del Runner e ri-clampiamo:
       cura le derive da throttling in background senza passare dall'IO.       */
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        resetRunnerTiming();
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w > 0 && h > 0) applyBounds(w, h);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    /* ── CLEANUP (ordine: observer → listener → GSAP → Matter) ──
       Ermetico: zero leak, zero processi orfani anche se l'unmount avviene a
       metà animazione o durante un resize.                                    */
    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(resizeRaf);

      container.removeEventListener('pointerenter', onPointerEnter);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      unlockEvents.forEach((ev) => window.removeEventListener(ev, unlockAudio));
      if (isCoarsePointer) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }

      // Matter.Mouse aggancia listener al container: vanno rimossi a mano.
      // (touchmove/start/end sono mappati su mousemove/down/up dentro Matter.)
      mouse.element.removeEventListener('mousemove', mouse.mousemove);
      mouse.element.removeEventListener('mousedown', mouse.mousedown);
      mouse.element.removeEventListener('mouseup', mouse.mouseup);
      mouse.element.removeEventListener('wheel', mouse.mousewheel);
      mouse.element.removeEventListener('touchmove', mouse.mousemove);
      mouse.element.removeEventListener('touchstart', mouse.mousedown);
      mouse.element.removeEventListener('touchend', mouse.mouseup);

      chaosRestoreRef.current?.kill();
      chaosRestoreRef.current = null;
      gsapCtx.revert(); // uccide ScrollTrigger + TUTTE le delayedCalls (drop + seal)

      Events.off(engine);            // rimuove afterUpdate + collisionStart
      Runner.stop(runner);           // ferma il loop rAF del Runner
      Composite.clear(engine.world, false, true);
      Engine.clear(engine);
      engineRef.current = null;
      bodyCooldowns.clear();
    };
  }, []);

  /* ── CAOS BUTTON (Zero Gravity) ──────────── */
  const triggerChaos = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const bodies = Matter.Composite
      .allBodies(engine.world)
      .filter((b) => b.label.startsWith('pill-'));

    // Guard: se nessuna pillola è ancora "piovuta" nel mondo, non invertiamo la
    // gravità (eviteremmo che le pillole spawnino fluttuando verso l'alto).
    if (bodies.length === 0) return;

    engine.gravity.y = -0.5;

    bodies.forEach((body) => {
      Matter.Sleeping.set(body, false); // sveglia i corpi dormienti
      const forceMagnitude = 0.04 * body.mass;
      Matter.Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * forceMagnitude,
        y: -forceMagnitude,
      });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.5);
    });

    // delayedCall al posto di setTimeout: killabile, niente doppi ripristini.
    // Tracciata in chaosRestoreRef → uccisa in cleanup (niente scrittura post-unmount).
    chaosRestoreRef.current?.kill();
    chaosRestoreRef.current = gsap.delayedCall(0.6, () => {
      if (engineRef.current) engineRef.current.gravity.y = GRAVITY_Y;
    });
  }, []);

  /* ── RENDER (design INVARIATO) ───────────── */
  return (
    <section
      style={{
        background: C.bgDeep,
        padding: 'clamp(5rem, 10vw, 10rem) 1.5rem',
        borderTop: '1px solid rgba(240,230,211,0.05)',
      }}
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          textAlign: 'center',
          marginBottom: 'clamp(2rem, 5vw, 4rem)',
        }}
      >
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.7rem',
            color: C.accent,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '1rem',
          }}
        >
          [ IL MIO ARSENALE ]
        </p>
        <h2
          style={{
            fontFamily: "'Outfit', 'Geist', sans-serif",
            fontWeight: 900,
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            color: C.text,
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          Tutto ciò che serve.
        </h2>
      </div>

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          maxWidth: '900px',
          width: '100%',
          height: '500px',
          margin: '0 auto',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)',
          borderRadius: '1.5rem',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5), 0 20px 40px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          cursor: 'grab',
          contain: 'layout paint', // isola repaint/layout della scena fisica
          touchAction: 'none',     // drag affidabile su touch
        }}
        onMouseDown={(e) => { e.currentTarget.style.cursor = 'grabbing'; }}
        onMouseUp={(e) => { e.currentTarget.style.cursor = 'grab'; }}
      >
        {/* LA TORCIA (SPOTLIGHT) — un solo elemento, will-change, quickTo */}
        <div
          ref={spotlightRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '400px',
            height: '400px',
            background:
              'radial-gradient(circle, rgba(244,162,97,0.15) 0%, transparent 60%)',
            borderRadius: '50%',
            pointerEvents: 'none',
            mixBlendMode: 'screen',
            opacity: 0,
            zIndex: 1,
            willChange: 'transform, opacity',
          }}
        />

        {/* IL CAOS BUTTON */}
        <button
          type="button"
          onClick={triggerChaos}
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 10,
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(244,162,97,0.3)',
            borderRadius: '0.3rem',
            padding: '0.5rem 1rem',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.65rem',
            color: C.accent,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            transition:
              'background 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(244,162,97,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          [ ZERO_GRAVITY ]
        </button>

        {/* LE PILLOLE — partono fuori scena: nessun flash in alto a sinistra */}
        {PILLS.map((pill, i) => (
          <div
            key={pill.label}
            ref={(el) => { pillRefs.current[i] = el; }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${pill.w}px`,
              height: `${PILL_H}px`,
              borderRadius: `${PILL_R}px`,
              background: pill.bg,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow:
                '0 8px 24px rgba(0,0,0,0.15), inset 0 2px 2px rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '1.05rem',
              fontWeight: 500,
              color: C.text,
              letterSpacing: '0.02em',
              userSelect: 'none',
              willChange: 'transform',
              zIndex: 5,
              transform: 'translate3d(-9999px, -9999px, 0)',
            }}
          >
            {pill.label}
          </div>
        ))}
      </div>
    </section>
  );
}