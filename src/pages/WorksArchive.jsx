import { useEffect, useRef, memo, useCallback, useState, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link, useNavigate } from 'react-router-dom';
import Spline from '@splinetool/react-spline';
import { useTransitionNavigate } from '../components/TransitionController';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/* ════════════════════════════════════════════════════════════════════
   WORKS ARCHIVE — "EVENT HORIZON / THE Z-AXIS ZIGGURAT"
   ────────────────────────────────────────────────────────────────────
   Concept  : l'utente non scorre una pagina — vola lungo l'asse Z
              dentro un corridoio di monoliti di vetro spaziale.
              Al centro, fissa e incombente, la SINGOLARITÀ: nucleo
              di luce bone-white con disco di accrescimento ambra
              e cilindro di luce verticale, che mangia la velocità
              di scroll (più voli forte, più si accende).

   Tecnica  : CSS 3D Transforms (perspective + preserve-3d) per il
              mondo — il testo resta DOM vero: nitido, selezionabile,
              cliccabile. Canvas 2D singolo per la Singolarità.
              Zero three.js, zero texture, zero dipendenze nuove.

   Movimento: la sezione è alta N×120vh con un layer sticky 100dvh.
              Un solo ScrollTrigger (scrub) tweena la translateZ del
              contenitore .world: i monoliti vengono incontro alla
              camera. Camera ferma, mondo in movimento = UN solo
              transform animato per il volo.

   Lenis    : il componente legge la velocity da ScrollTrigger
              (self.getVelocity()), quindi funziona sia con scroll
              nativo che con Lenis. PREREQUISITO a livello sito
              (di solito già presente nel tuo setup):
                lenis.on('scroll', ScrollTrigger.update);
                gsap.ticker.add(t => lenis.raf(t * 1000));
                gsap.ticker.lagSmoothing(0);

   Performance:
   - Vetro SINTETICO (rgba + hairline + inset highlight): niente
     backdrop-filter su elementi in movimento 3D.
   - Culling a finestra: i monoliti fuori dal range Z visibile sono
     visibility:hidden → il compositor li scarta del tutto.
   - Depth-of-field finto: sola opacity contro il nero OLED.
   - Singolarità con Quality Governor a 3 tier (DPR + particelle),
     sprite glow pre-renderizzati, zero allocazioni nel loop.
   - Skew magnetico via gsap.quickTo su UN solo elemento (.world).

   ────────────────────────────────────────────────────────────────────
   ★ FIX FOUC 3D (refactor del ciclo di vita) — vedi il blocco MAIN:
     il gsap.context è ora montato UNA SOLA VOLTA e non viene mai
     distrutto/ricreato quando il sipario (archiveReady) svanisce. Le
     posizioni Z dei monoliti vengono calcolate "al buio" al mount e
     sopravvivono intatte al re-render di React (memo + ref stabili).
════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — coerenti col preloader (void / bone / amber)
═══════════════════════════════════════════════════════════════ */
const T = {
  void:      '#050505',
  bone:      '#E8E3D8',
  boneDim:   'rgba(232,227,216,0.45)',
  boneGhost: 'rgba(232,227,216,0.14)',
  hairline:  'rgba(232,227,216,0.08)',
  amber:     '#D89C4A',
  amberDim:  'rgba(216,156,74,0.40)',
  amberGhost:'rgba(216,156,74,0.10)',
};
const MONO  = "'JetBrains Mono','IBM Plex Mono','ui-monospace','SFMono-Regular',Menlo,monospace";
const EASE  = 'cubic-bezier(0.32, 0.72, 0, 1)'; // curva firma del sito

/* ═══════════════════════════════════════════════════════════════
   DATI PROGETTI
═══════════════════════════════════════════════════════════════ */
const PROJECTS = [
  {
    id:       'aeon-concept-01',
    index:    'INDEX//01',
    name:     'Aurora Skeletonized',
    category: 'Interactive',
    role:     'Creative Engineer',
    year:     '2026',
    image:    '/images/copertinaOrologio.jpg',
    wide:     true,
    tags:     ['React', 'GSAP', 'Canvas', 'WebGL-like'],
    link:     '/projects/aeon-camera',
  },
  {
    id:       'kids-platform',
    index:    'INDEX//02',
    name:     'KidS Platform',
    category: 'Web App',
    role:     'Full-Stack',
    year:     '2026',
    image:    '/projects/kids-platform.jpg',
    wide:     false,
    tags:     ['FastAPI', 'Flutter', 'PostgreSQL'],
    link:     '#',
  },
  {
    id:       'portfolio-v4',
    index:    'INDEX//03',
    name:     'Portfolio v4',
    category: 'Design System',
    role:     'UI Engineer',
    year:     '2024',
    image:    '/projects/portfolio.jpg',
    wide:     true,
    tags:     ['React', 'GSAP', 'CSS'],
    link:     '#',
  },
  {
    id:       'lab-experiments',
    index:    'INDEX//04',
    name:     'The Lab',
    category: 'Interactive',
    role:     'WebGL Dev',
    year:     '2026',
    image:    '/projects/lab.jpg',
    wide:     false,
    tags:     ['WebGL', 'Canvas', 'GLSL'],
    link:     '#',
  },
  {
    id:       'software-3d-engine',
    index:    'INDEX//05',
    name:     'Software 3D Engine',
    category: 'Graphics Engine',
    role:     'Systems Dev',
    year:     '2026',
    image:    '/images/immagine3D.avif',
    wide:     false,
    tags:     ['C', 'SDL2', '3D Math'],
    link:     '/projects/software-3d-engine',
  },
  {
    id:       'zx-spectrum-ai',
    index:    'INDEX//06',
    name:     'ZX Spectrum AI',
    category: 'Engineering',
    role:     'Software Dev',
    year:     '2026',
    image:    '/images/fotoMonroe.avif',
    wide:     true,
    tags:     ['C', 'Algorithms', 'WebAssembly'],
    link:     '/projects/zx-spectrum',
  },
];
const N = PROJECTS.length;

/* ═══════════════════════════════════════════════════════════════
   COSTANTI DEL MONDO 3D  ── INVARIATE (requisito #3: non toccare)
═══════════════════════════════════════════════════════════════ */
const SPACING     = 1600;  // distanza Z tra un monolite e il successivo (px)
const START       = 1200;  // distanza Z del primo monolite dal piano focale
const FAR_FADE    = 3000;  // distanza oltre la quale un monolite è invisibile
const BEHIND_FADE = 520;   // px dietro la camera entro cui svanisce (< perspective!)
const FOCUS_RANGE = 420;   // |depth| entro cui un monolite è "in focus"
const TOTAL_Z     = START + (N - 1) * SPACING; // corsa totale del mondo
const PERSPECTIVE = 1200;  // px — BEHIND_FADE deve restare sotto questo valore

/* ════════════════════════════════════════════════════════════════════
   CORE SPLINE — scena 3D al centro del tunnel (sostituisce Singularity)
   ────────────────────────────────────────────────────────────────────
   ┌──────────────────────────────────────────────────────────────────┐
   │  👉  CONFIGURAZIONE — DEVI MODIFICARE SOLO QUESTE DUE STRINGHE  👈 │
   └──────────────────────────────────────────────────────────────────┘
     • SPLINE_SCENE_URL   : l'URL .splinecode esportato da Spline
                            (Export → "Code / React" → copia l'URL che
                            finisce con `…/scene.splinecode`).
     • TARGET_OBJECT_NAME : il nome ESATTO dell'oggetto da animare, così
                            come appare nel pannello Objects di Spline
                            (es. 'Microchip', 'Core', 'Cube'…).

   COME FUNZIONA (il resto è già pronto, non serve toccarlo):
   - <Spline onLoad> salva l'istanza dell'app in `splineAppRef`.
   - Un singolo gsap.ticker legge `speedRef.current` (velocity di scroll
     normalizzata 0..1, calcolata nel Main) e applica un "tilt magnetico"
     + una rotazione continua all'oggetto target → fisicità allo scroll.
   - Un IntersectionObserver fa da KILL-SWITCH: quando la sezione esce
     dalla viewport, il ticker GSAP viene SCOLLEGATO (zero lavoro CPU/GPU
     speso a muovere una scena che nessuno vede). Rientrando, si riattacca.

   props:
   - speedRef : useRef numerico (0..1) — MAI state, zero re-render React
   - reduced  : prefers-reduced-motion → nessuna animazione di tilt
═══════════════════════════════════════════════════════════════════════ */

/* ▼▼▼ INSERISCI QUI I TUOI VALORI ▼▼▼ */
const SPLINE_SCENE_URL   = 'https://prod.spline.design/QresRyIZehUKtfON/scene.splinecode';
const TARGET_OBJECT_NAME = 'Battery';
/* ▲▲▲ INSERISCI QUI I TUOI VALORI ▲▲▲ */

/* ════════════════════════════════════════════════════════════════════
   ⚠️  KILL-SWITCH PROTETTO (requisito #4) — QUESTO COMPONENTE È INVARIATO.
   Il Ticker GSAP agganciato all'IntersectionObserver, col trucco
   visibility:hidden / visibility:visible per spegnere la GPU fuori
   viewport, funziona perfettamente e NON è stato toccato dal refactor.
═══════════════════════════════════════════════════════════════════════ */
const CoreSpline = memo(({ speedRef, reduced, onReady }) => {
  const wrapRef       = useRef(null); // wrapper osservato dall'IntersectionObserver
  const splineAppRef  = useRef(null); // istanza dell'app Spline (salvata in onLoad)
  const targetObjRef  = useRef(null); // oggetto 3D risolto via findObjectByName

  /* onLoad: Spline è pronto → memorizza l'app e pre-risolve l'oggetto.
     (Se il nome non esiste, targetObjRef resta null e il ticker non fa
      nulla: nessun crash, la scena resta comunque visibile.)            */
  const handleLoad = (app) => {
    splineAppRef.current = app;
    targetObjRef.current = app.findObjectByName(TARGET_OBJECT_NAME) || null;

    // 2. MASCHERIAMO IL MICROSCATTO
    // Diamo a Spline 100 millisecondi per fare il suo ricalcolo "al buio"
    setTimeout(() => {
      onReady(true);
    }, 200);
  };

  /* ── TICKER GSAP + KILL-SWITCH IntersectionObserver ─────────────────
     L'observer NON si limita a un flag: aggancia/sgancia fisicamente il
     ticker dal loop di GSAP. Fuori viewport = zero callback per frame.  */
  useEffect(() => {
    if (reduced) return;            // reduced-motion: scena statica, niente tilt
    const el = wrapRef.current;
    if (!el) return;

    let curTiltX = 0;  // tilt corrente smorzato (asse X — "becca/alza il muso")
    let curTiltY = 0;  // tilt corrente smorzato (asse Y — "sterza")
    let spin     = 0;  // rotazione continua accumulata sull'asse Y

    /* Letto ogni frame finché il ticker è agganciato. */
    const tick = () => {
      const app = splineAppRef.current;
      if (!app) return;
      /* Risoluzione lazy: se onLoad non ha trovato l'oggetto subito,
         ritenta finché non compare (scene con caricamento progressivo). */
      if (!targetObjRef.current) {
        targetObjRef.current = app.findObjectByName(TARGET_OBJECT_NAME) || null;
      }
      const obj = targetObjRef.current;
      if (!obj) return;

      /* velocity normalizzata 0..1 (il segno lo recupero dal raw value) */
      const raw = speedRef.current;
      const v   = Math.min(Math.abs(raw), 1);

      /* TILT MAGNETICO: bersaglio proporzionale alla velocità, raggiunto
         con un lerp (×0.08) → inerzia morbida, mai scatti. ~0.45 rad max. */
      const targetX = v * 0.45 * (raw < 0 ? -1 : 1); // direzione = verso di scroll
      const targetY = v * 0.30 * (raw < 0 ? -1 : 1);
      curTiltX += (targetX - curTiltX) * 0.08;
      curTiltY += (targetY - curTiltY) * 0.08;

      /* ROTAZIONE CONTINUA: gira sempre piano (idle) e accelera con lo
         scroll → il chip "sente" la velocità del volo lungo l'asse Z.   */
      spin += 0.0015 + v * 0.05;

      /* L'API di Spline espone rotation in RADIANTI sui tre assi. */
      obj.rotation.x = curTiltX;
      obj.rotation.y = spin + curTiltY;
    };

    let attached = false;
    const attach = () => {
      if (!attached) {
        gsap.ticker.add(tick);
        el.style.visibility = 'visible'; // <-- SVEGLIA LA GPU
        attached = true;
      }
    };
    const detach = () => {
      if (attached) {
        gsap.ticker.remove(tick);
        el.style.visibility = 'hidden'; // <-- IL VERO HARDWARE KILL-SWITCH
        attached = false;
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => { entry.isIntersecting ? attach() : detach(); },
      { threshold: 0.01 } // basta un pixel visibile per riaccendere
    );
    io.observe(el);

    return () => {
      detach();
      io.disconnect();
    };
  }, [speedRef, reduced]);

  /* Wrapper: stessi position/inset/zIndex del vecchio <canvas> della
     Singularity → resta SOTTO i monoliti (.zg-viewport ha z-index 4)
     e sopra il fondo nero della sezione.                              */
  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        zIndex: 2, pointerEvents: 'none',
      }}
    >
      <Spline
        scene={SPLINE_SCENE_URL}
        onLoad={handleLoad}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MONOLITH — scheda di vetro spaziale (DOM puro, vetro sintetico)
   Statica: posizione 3D impostata UNA volta (gsap.set).
   Dinamica: solo opacity / visibility / classe .is-focus.

   NB FIX: è `memo`. Con refCb / onOpen STABILI (vedi Main) questo
   componente NON si ri-renderizza mai dopo il mount → React non
   riscrive lo `style` inline e non stacca/riattacca il nodo, quindi i
   transform 3D iniettati da GSAP restano intatti per sempre.
═══════════════════════════════════════════════════════════════ */
const Monolith = memo(({ project, refCb, onOpen }) => (
  <article
    ref={refCb}
    className={`zg-monolith ${project.wide ? 'zg-wide' : ''} zg-init-hidden`}
  >
    {/* TUTTA la card è il link: superficie di click massima.
        La pillola "OPEN PROJECT" resta come affordance visiva (span). */}
    <Link
      className="zg-link"
      to={project.link}
      aria-label={`Apri il progetto ${project.name}`}
      draggable={false}
      onClick={(e) => onOpen?.(e, project.link)}
    >
      <div className="zg-shell">
        <div className="zg-card">

          <div className="zg-card-head">
            <span className="zg-eyebrow">{project.index}</span>
            <span className="zg-cat">{project.category}</span>
          </div>

          <h2 className="zg-name">{project.name}</h2>

          <div className="zg-frame">
            <div className="zg-frame-fallback" aria-hidden>
              <span>{project.index.slice(-2)}</span>
            </div>
            <img
              src={project.image}
              alt={project.name}
              loading="lazy"
              decoding="async"
              onError={e => { e.currentTarget.style.opacity = 0; }}
            />
            <div className="zg-frame-glare" aria-hidden />
          </div>

          <div className="zg-meta">
            <span>{project.role}</span>
            <span className="zg-meta-sep" aria-hidden>—</span>
            <span>{project.year}</span>
          </div>

          <div className="zg-tags">
            {project.tags.map(tag => (
              <span key={tag} className="zg-tag">{tag}</span>
            ))}
          </div>

          <span className="zg-cta">
            <span>OPEN PROJECT</span>
            <span className="zg-cta-orb" aria-hidden>↗</span>
          </span>

        </div>
      </div>
    </Link>
  </article>
));

/* ═══════════════════════════════════════════════════════════════
   MAIN — WORKS ARCHIVE
   ────────────────────────────────────────────────────────────────
   ARCHITETTURA DEL CICLO DI VITA (fix del FOUC 3D)

   Il bug nasceva da `archiveReady` nell'array di dipendenze dell'unico
   useEffect: ogni volta che il sipario svaniva, React eseguiva la
   cleanup → `gsapCtx.revert()` AZZERAVA tutti gli stili inline scritti
   da gsap.set() (le translateZ dei monoliti), poi ricreava il context.
   Nella finestra tra revert e re-init, le card tornavano a Z:0 (enormi,
   in primo piano) proprio mentre il container diventava visibile.

   La soluzione separa nettamente le responsabilità in DUE effetti:

   • EFFECT A  (mount-once, deps [reducedMotion]) — possiede GSAP.
     Crea il gsap.context UNA volta, calcola le matrici z/rotationY
     "al buio" (opacity:0 non impedisce il calcolo dei transform),
     installa ScrollTrigger e resta in ascolto. NON dipende da
     archiveReady → non viene MAI revertito al cambio del loader.

   • EFFECT B  (deps [archiveReady]) — NON tocca GSAP.
     Quando il sipario si alza, ri-asserisce SOLO il frame iniziale
     (placeMonoliths + applyWorld(0,0)) dentro un requestAnimationFrame,
     come rete di sicurezza idempotente. Nessun revert, nessuna ricreazione.
═══════════════════════════════════════════════════════════════ */
export default function WorksArchive() {
  const sectionRef  = useRef(null);
  const worldRef    = useRef(null);
  const counterRef  = useRef(null);
  const hintRef     = useRef(null);
  const railRefs    = useRef([]);
  const monolithEls = useRef([]);
  const tNavigate = useTransitionNavigate();

  /* Ponti verso le funzioni interne al gsap.context, così EFFECT B può
     ri-forzare il frame iniziale senza ricreare nulla di GSAP. */
  const applyWorldRef      = useRef(null);
  const placeMonolithsRef  = useRef(null);

  // 1. STATO DI CARICAMENTO GLOBALE DELL'ARCHIVIO
  const [archiveReady, setArchiveReady] = useState(false);

  /* ── REF CALLBACK STABILI (chiave del fix lato React) ───────────────
     Create una sola volta (lazy-init). Avendo identità immutabile, i
     <Monolith> memoizzati NON si ri-renderizzano al cambio di state e
     React non esegue il ciclo detach(null)/attach(el) sul callback ref:
     i transform inline di GSAP sull'<article> sopravvivono al re-render.  */
  const monolithRefCbs = useRef(null);
  if (!monolithRefCbs.current) {
    monolithRefCbs.current = PROJECTS.map((_, i) => (el) => { monolithEls.current[i] = el; });
  }
  const railRefCbs = useRef(null);
  if (!railRefCbs.current) {
    railRefCbs.current = PROJECTS.map((_, i) => (el) => { railRefs.current[i] = el; });
  }

  const handleReturnClick = (e) => {
    e.preventDefault();
    tNavigate('/', { state: { scrollTo: 'sezione-lavori' } });
  };

  // ── FIX #2: IMMUTABILITÀ DEL CALLBACK DI NAVIGAZIONE ──
  const tNavigateRef = useRef(tNavigate);
  useEffect(() => { tNavigateRef.current = tNavigate; }, [tNavigate]);

  const handleOpenProject = useCallback((e, link) => {
    e.preventDefault();
    if (!link || link === '#') return;
    tNavigateRef.current(link);
  }, []); // <--- Array vuoto = niente più re-render accidentali per colpa del router

  const speedRef = useRef(0);

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ════════════════════════════════════════════════════════════════
     EFFECT A — GSAP MOUNT-ONCE  (deps: [reducedMotion] — NIENTE archiveReady)
     Possiede il gsap.context per tutta la vita del componente.
     Calcola le posizioni 3D "al buio" e installa lo ScrollTrigger.
  ═══════════════════════════════════════════════════════════════════ */
  useEffect(() => {

    const section = sectionRef.current;
    const world   = worldRef.current;
    if (!section || !world) return;

    const gsapCtx = gsap.context(() => {
      /* ── placeMonoliths: posa statica dei monoliti lungo l'asse Z ──
         Usa solo window.innerWidth/innerHeight → calcolabile anche con
         il container a opacity:0 (l'opacity non azzera i transform). */
      const placeMonoliths = () => {
        const W = window.innerWidth;
        const mob = W < 768;
        monolithEls.current.forEach((el, i) => {
          if (!el) return;
          const side = i % 2 === 0 ? -1 : 1;
          gsap.set(el, {
            x: side * W * (mob ? 0.06 : 0.21),
            y: (i % 2 === 0 ? -1 : 1) * window.innerHeight * 0.035,
            z: -(START + i * SPACING),
            rotationY: side * (mob ? -8 : -14),
            xPercent: -50,
            yPercent: -50,
            force3D: true,
          });
        });
      };
      placeMonoliths();

      const zSet   = gsap.quickSetter(world, 'z', 'px');
      const skewTo = gsap.quickTo(world, 'skewY', {
        duration: 0.55, ease: 'power3.out',
      });
      gsap.set(world, { force3D: true });

      let lastFocus  = -1;
      let lastRail   = -1;
      let hintHidden = false;
      let lastScrollTs = 0;

      /* ── applyWorld: INVARIATA (requisito #3). Tutta la matematica di
         culling, opacity, focus, rail e logica visibility:hidden è
         identica all'originale. */
      const applyWorld = (progress, velocity) => {
        const worldZ = progress * TOTAL_Z;
        zSet(worldZ);

        const v = Math.max(-1, Math.min(1, velocity / 3200));
        speedRef.current = Math.abs(v);
        if (!reducedMotion) skewTo(v * -3.2);
        lastScrollTs = performance.now();

        if (!hintHidden && progress > 0.012 && hintRef.current) {
          hintHidden = true;
          gsap.to(hintRef.current, { opacity: 0, duration: 0.8, ease: 'power2.out' });
        }

        let focusIdx = -1;
        for (let i = 0; i < N; i++) {
          const el = monolithEls.current[i];
          if (!el) continue;
          const d = worldZ - (START + i * SPACING);
          let op;
          if (d > 0) {
            op = 1 - d / BEHIND_FADE;
          } else {
            const t = 1 + d / FAR_FADE;
            op = t <= 0 ? 0 : Math.pow(t, 1.8);
          }
          op = Math.max(0, Math.min(1, op));
          el.style.opacity = op;
          el.style.visibility = op < 0.02 ? 'hidden' : 'visible';
          const live = op > 0.25 && d < BEHIND_FADE * 0.85;
          if (el.dataset.live !== String(live)) {
            el.dataset.live = String(live);
            el.style.pointerEvents = live ? 'auto' : 'none';
          }
          if (Math.abs(d) < FOCUS_RANGE) focusIdx = i;
        }

        if (focusIdx !== lastFocus) {
          if (lastFocus >= 0) monolithEls.current[lastFocus]?.classList.remove('is-focus');
          if (focusIdx >= 0)  monolithEls.current[focusIdx]?.classList.add('is-focus');
          lastFocus = focusIdx;
        }

        const railIdx = Math.max(0, Math.min(N - 1, Math.round((worldZ - START) / SPACING)));
        if (railIdx !== lastRail) {
          if (lastRail >= 0) railRefs.current[lastRail]?.classList.remove('is-here');
          railRefs.current[railIdx]?.classList.add('is-here');
          lastRail = railIdx;
          if (counterRef.current) {
            counterRef.current.textContent =
              `${String(railIdx + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
          }
        }
      };

      /* Espongo le due funzioni a EFFECT B SENZA ricreare GSAP:
         sono assegnate in modo SINCRONO dentro gsap.context(), quindi
         pronte prima ancora che EFFECT B (dichiarato dopo) venga eseguito. */
      placeMonolithsRef.current = placeMonoliths;
      applyWorldRef.current     = applyWorld;

      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: self => applyWorld(self.progress, self.getVelocity()),
      });

      const calm = () => {
        if (performance.now() - lastScrollTs > 140 && speedRef.current > 0.001) {
          speedRef.current = 0;
          if (!reducedMotion) skewTo(0);
        }
      };
      gsap.ticker.add(calm);

      /* ── FRAME INIZIALE FORZATO (requisito #2) ─────────────────────
         1) Sincrono adesso: posa subito i monoliti a Z lontana.
         2) Su requestAnimationFrame: ri-asserisce DOPO che il layout si
            è assestato, così nulla (font, reflow, mount) può sovrascrivere
            la posa iniziale prima del primo paint utile.                */
      applyWorld(0, 0);
      const raf1 = requestAnimationFrame(() => {
        placeMonoliths();
        applyWorld(0, 0);
      });

      let prevW = window.innerWidth;
      let rTimer = 0;
      const onResize = () => {
        if (Math.abs(window.innerWidth - prevW) <= 30) return;
        clearTimeout(rTimer);
        rTimer = setTimeout(() => {
          prevW = window.innerWidth;
          placeMonoliths();
          ScrollTrigger.refresh();
        }, 200);
      };
      window.addEventListener('resize', onResize, { passive: true });

      return () => {
        cancelAnimationFrame(raf1);
        gsap.ticker.remove(calm);
        clearTimeout(rTimer);
        window.removeEventListener('resize', onResize);
        // I ponti puntano a closure di QUESTO context: azzeriamoli al revert.
        placeMonolithsRef.current = null;
        applyWorldRef.current     = null;
      };
    }, section);

    return () => gsapCtx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]); // ⛔️ archiveReady NON è qui: il context vive una sola volta

  /* ════════════════════════════════════════════════════════════════
     EFFECT B — RI-ASSERZIONE AL SOLLEVARSI DEL SIPARIO (FIX #3)
     Usa useLayoutEffect: agisce sincronicamente PRIMA che il browser 
     dipinga a schermo la nuova opacità dell'UI, evitando ogni flash.
  ═══════════════════════════════════════════════════════════════════ */
  useLayoutEffect(() => {
    if (!archiveReady) return;
    placeMonolithsRef.current?.();
    applyWorldRef.current?.(0, 0);
  }, [archiveReady]);

  return (
    <section
      ref={sectionRef}
      className="zg-section"
      style={{
        position: 'relative',
        height: `${N * 120}svh`, // spazio di scroll reale → Lenis-friendly
        background: T.void,
        fontFamily: MONO,
      }}
    >
      {/* SIPARIO DI CARICAMENTO GLOBALE TECH-LUXURY */}
      <div
        className="zg-global-loader"
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: T.void, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '1rem',
          pointerEvents: archiveReady ? 'none' : 'auto',
          opacity: archiveReady ? 0 : 1,
          transition: 'opacity 0.6s cubic-bezier(0.32, 0.72, 0, 1)'
        }}
      >
        <span style={{ color: T.amber, fontSize: '0.6rem', letterSpacing: '0.4em', animation: 'zgHint 1.5s ease infinite' }}>
          INITIALIZING QUANTUM CORE //
        </span>
      </div>

      {/* ── LAYER STICKY: la "camera" ─────────────────────────── */}
      <div className="zg-camera">

        {/* Core Spline — scena 3D fissa al centro, sotto i monoliti (z-index:2) */}
        <CoreSpline speedRef={speedRef} reduced={reducedMotion} onReady={() => setArchiveReady(true)} />

        {/* Tutto il contenuto visivo emerge in sincrono solo quando archiveReady è true.
            STACKING CONTEXT (requisito #5):
            - zIndex:10 è INCONDIZIONATO (non dipende da archiveReady).
            - isolation:'isolate' forza un contesto di impilamento STABILE: con
              opacity<1 il browser ne crea uno comunque, ma a opacity:1 (fine fade)
              quel contesto svanirebbe e l'ordine si ricalcolerebbe. Con isolate il
              contesto c'è SEMPRE → il canvas Spline (z-index:2) non può mai
              "saltare" davanti alla UI durante o dopo il fade 0→1.            */}
        <div style={{
          position: 'absolute', inset: 0,
          zIndex: 10,
          isolation: 'isolate',
          willChange: 'opacity',
          opacity: archiveReady ? 1 : 0,
          transition: 'opacity 0.9s cubic-bezier(0.32, 0.72, 0, 1)'
        }}>
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0,0,0,0.75) 100%)',
          }} />

          <div className="zg-viewport">
            <div ref={worldRef} className="zg-world">
              {PROJECTS.map((p, i) => (
                <Monolith
                  key={p.id}
                  project={p}
                  onOpen={handleOpenProject}
                  refCb={monolithRefCbs.current[i]}
                />
              ))}
            </div>
          </div>

          <header className="zg-hud-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(1rem, 3vw, 2rem)' }}>
              <a href="/" onClick={handleReturnClick} className="zg-back-btn" aria-label="Torna alla Home">
                <span className="zg-back-icon" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                </span>
                <span>SYS.RETURN</span>
              </a>
              <span className="zg-hud-label hide-mobile">WORKS — ARCHIVE //</span>
            </div>
            <span ref={counterRef} className="zg-hud-counter">01 / {String(N).padStart(2, '0')}</span>
          </header>

          <nav className="zg-rail" aria-label="Posizione nell'archivio">
            {PROJECTS.map((p, i) => (
              <span
                key={p.id}
                ref={railRefCbs.current[i]}
                className={`zg-rail-dot ${i === 0 ? 'is-here' : ''}`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
            ))}
          </nav>

          <div ref={hintRef} className="zg-hint" aria-hidden>
            SCROLL TO FLY — Z-AXIS NAVIGATION
          </div>
        </div>
      </div>

      <style>{`
        /* ═══ CAMERA (sticky, niente pin-spacer GSAP) ═══════════
           100dvh segue la URL bar iOS; fallback 100vh implicito.
           isolation:isolate → contesto di impilamento radice della
           camera: Spline(z2) e UI(z10) sono confrontati QUI dentro,
           in modo deterministico, senza interferenze dall'esterno. */
        .zg-camera {
          position: sticky;
          top: 0;
          height: 100svh;
          overflow: hidden;
          isolation: isolate;
        }

        /* ═══ MONDO 3D ══════════════════════════════════════════ */
        .zg-viewport {
          position: absolute;
          inset: 0;
          z-index: 4;
          perspective: ${PERSPECTIVE}px;
          perspective-origin: 50% 50%;
        }
        .zg-world {
          position: absolute;
          inset: 0;
          transform-style: preserve-3d;
          will-change: transform; /* unico will-change: l'elemento che vola */
        }

        /* ═══ MONOLITI ══════════════════════════════════════════
           Posizione 3D via GSAP (x/y/z/rotationY impostati a JS).
           Qui solo aspetto. Vetro SINTETICO: zero backdrop-filter. */
        .zg-init-hidden {
          visibility: hidden;
          opacity: 0;
        }
        .zg-monolith {
          position: absolute;
          top: 50%;
          left: 50%;
          width: clamp(300px, 34vw, 480px);
          pointer-events: none; /* clic abilitati solo in focus */
        }
        .zg-monolith.zg-wide { width: clamp(320px, 38vw, 560px); }

        /* L'intera card è un link */
        .zg-link {
          display: block;
          color: inherit;
          text-decoration: none;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .zg-link:active .zg-shell { transform: scale(0.99); }

        /* L'hover su QUALSIASI punto della card anima la pillola */
        .zg-link:hover .zg-cta { border-color: ${T.amberDim}; }
        .zg-link:hover .zg-cta-orb {
          transform: translate(2px, -2px) scale(1.05);
          background: rgba(216,156,74,0.18);
        }
        .zg-link:hover .zg-shell { border-color: rgba(232,227,216,0.18); }

        .zg-shell {
          padding: 0.45rem;
          border-radius: 1.4rem;
          background: rgba(232,227,216,0.03);
          border: 1px solid ${T.hairline};
          transition: border-color 0.7s ${EASE}, background 0.7s ${EASE},
                      box-shadow 0.9s ${EASE}, transform 0.35s ${EASE};
        }
        .zg-card {
          border-radius: calc(1.4rem - 0.45rem);
          background: rgba(8,8,8,0.78);
          border: 1px solid rgba(232,227,216,0.06);
          box-shadow: inset 0 1px 1px rgba(232,227,216,0.07);
          padding: clamp(1.1rem, 2vw, 1.7rem);
          display: flex;
          flex-direction: column;
          gap: clamp(0.7rem, 1.4svh, 1rem);
        }

        .zg-card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
        }
        .zg-eyebrow {
          font-size: 0.55rem;
          letter-spacing: 0.32em;
          color: ${T.amber};
          text-transform: uppercase;
        }
        .zg-cat {
          font-size: 0.52rem;
          letter-spacing: 0.22em;
          color: ${T.boneGhost};
          text-transform: uppercase;
          white-space: nowrap;
        }

        .zg-name {
          margin: 0;
          font-size: clamp(1.5rem, 2.6vw, 2.4rem);
          font-weight: 300;
          line-height: 1.02;
          letter-spacing: -0.03em;
          color: ${T.bone};
          text-transform: uppercase;
        }

        /* Cornice immagine — inner core */
        .zg-frame {
          position: relative;
          aspect-ratio: 16 / 10;
          border-radius: 0.8rem;
          overflow: hidden;
          border: 1px solid rgba(232,227,216,0.06);
          background: #0a0a0a;
        }
        .zg-frame img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          /* reveal in focus: scala + opacity, GPU-only */
          opacity: 0.55;
          transform: scale(1.06);
          transition: opacity 0.9s ${EASE}, transform 1.2s ${EASE};
        }
        .zg-frame-fallback {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 50% 60%, ${T.amberGhost}, transparent 70%);
        }
        .zg-frame-fallback span {
          font-size: 3.4rem;
          font-weight: 300;
          color: ${T.boneGhost};
          letter-spacing: -0.04em;
        }
        /* ═══ DYNAMIC GLARE ══════════════════════════════════════
           Il riflesso è un layer SOVRADIMENSIONATO (inset -40%) che
           trasla via transform quando il monolite entra in focus →
           la luce "scivola" sul vetro come un riflesso reale.
           Transform + opacity: GPU-only, zero repaint.            */
        .zg-frame-glare {
          position: absolute;
          inset: -40%;
          background: linear-gradient(
            155deg,
            transparent 30%,
            rgba(232,227,216,0.13) 46%,
            rgba(232,227,216,0.05) 52%,
            transparent 64%
          );
          opacity: 0.55;
          transform: translate3d(-14%, -10%, 0);
          transition: transform 1.4s ${EASE}, opacity 1.4s ${EASE};
          pointer-events: none;
        }

        .zg-meta {
          display: flex;
          gap: 0.6rem;
          font-size: 0.56rem;
          letter-spacing: 0.2em;
          color: ${T.boneDim};
          text-transform: uppercase;
        }
        .zg-meta-sep { color: ${T.boneGhost}; }

        .zg-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .zg-tag {
          font-size: 0.5rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${T.boneDim};
          border: 1px solid ${T.hairline};
          border-radius: 999px;
          padding: 0.26rem 0.6rem;
        }

        /* CTA pillola — ora è uno SPAN decorativo dentro .zg-link:
           l'hover è gestito dalle regole .zg-link:hover più sopra */
        .zg-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.7rem;
          align-self: flex-start;
          margin-top: 0.2rem;
          padding: 0.5rem 0.55rem 0.5rem 1.1rem;
          border-radius: 999px;
          border: 1px solid ${T.hairline};
          color: ${T.bone};
          font-size: 0.56rem;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.6s ${EASE}, transform 0.6s ${EASE},
                      border-color 0.6s ${EASE};
        }
        .zg-cta-orb {
          width: 1.6rem;
          height: 1.6rem;
          border-radius: 999px;
          background: rgba(232,227,216,0.08);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          color: ${T.amber};
          transition: transform 0.6s ${EASE}, background 0.6s ${EASE};
        }

        /* ═══ STATO FOCUS — il monolite "cattura" ═══════════════
           (niente pointer-events qui: la cliccabilità è governata
           dal JS via dataset.live, molto prima del focus)         */
        .zg-monolith.is-focus .zg-shell {
          border-color: rgba(232,227,216,0.22);
          background: rgba(232,227,216,0.05);
          box-shadow:
            0 0 0 1px rgba(216,156,74,0.14),
            0 0 48px rgba(216,156,74,0.10),
            inset 0 1px 1px rgba(232,227,216,0.10);
        }
        .zg-monolith.is-focus .zg-frame img {
          opacity: 1;
          transform: scale(1);
        }
        .zg-monolith.is-focus .zg-frame-glare {
          opacity: 1;
          transform: translate3d(10%, 8%, 0);
        }
        .zg-monolith.is-focus .zg-cta {
          opacity: 1;
          transform: translateY(0);
        }

        /* ═══ HUD ═══════════════════════════════════════════════ */
        .zg-hud-top {
          position: absolute;
          top: 0; left: 0; right: 0;
          z-index: 10;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.1rem clamp(0.85rem, 4vw, 3rem);
          border-bottom: 1px solid ${T.hairline};
          pointer-events: none;
        }
        .zg-hud-label {
          font-size: clamp(0.5rem, 1.1vw, 0.6rem);
          letter-spacing: 0.26em;
          color: ${T.boneDim};
          text-transform: uppercase;
        }
        .zg-hud-counter {
          font-size: clamp(0.5rem, 1.1vw, 0.6rem);
          letter-spacing: 0.2em;
          color: ${T.amber};
          font-variant-numeric: tabular-nums;
        }

        /* Back-button SYS.RETURN — unico elemento interattivo del HUD */
        .zg-back-btn {
          pointer-events: auto;
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.45rem 0.95rem 0.45rem 0.55rem;
          border-radius: 999px;
          border: 1px solid ${T.hairline};
          background: rgba(5,5,5,0.5);
          color: ${T.boneDim};
          text-decoration: none;
          font-size: 0.54rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          transition: border-color 0.6s ${EASE}, color 0.6s ${EASE};
        }
        .zg-back-btn:hover { border-color: ${T.amberDim}; color: ${T.bone}; }
        .zg-back-btn:active { transform: scale(0.98); }
        .zg-back-icon {
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 999px;
          background: rgba(232,227,216,0.08);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: ${T.amber};
          transition: transform 0.6s ${EASE}, background 0.6s ${EASE};
        }
        .zg-back-btn:hover .zg-back-icon {
          transform: translateX(-3px);
          background: rgba(216,156,74,0.18);
        }

        .zg-rail {
          position: absolute;
          right: clamp(0.85rem, 4vw, 3rem);
          top: 50%;
          transform: translateY(-50%);
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          pointer-events: none;
        }
        .zg-rail-dot {
          font-size: 0.5rem;
          letter-spacing: 0.18em;
          color: ${T.boneGhost};
          font-variant-numeric: tabular-nums;
          transition: color 0.5s ${EASE}, transform 0.5s ${EASE};
        }
        .zg-rail-dot.is-here {
          color: ${T.amber};
          transform: translateX(-4px);
        }

        .zg-hint {
          position: absolute;
          bottom: clamp(1.2rem, 4svh, 2.4rem);
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          font-size: 0.5rem;
          letter-spacing: 0.3em;
          color: ${T.boneDim};
          text-transform: uppercase;
          white-space: nowrap;
          pointer-events: none;
          animation: zgHint 2.8s ${EASE} infinite;
        }

        @keyframes zgHint { 0%,100%{opacity:0.85} 50%{opacity:0.3} }

        /* ═══ MOBILE COLLAPSE (<768px) ══════════════════════════ */
        @media (max-width: 767px) {
          .zg-monolith,
          .zg-monolith.zg-wide { width: min(86vw, 420px); }
          .zg-rail { display: none; }
          .zg-name { font-size: clamp(1.3rem, 7vw, 1.8rem); }
        }

        /* ═══ REDUCED MOTION ════════════════════════════════════ */
        @media (prefers-reduced-motion: reduce) {
          .zg-hint { animation: none; }
          .zg-frame img,
          .zg-frame-glare,
          .zg-cta,
          .zg-shell,
          .zg-cta-orb,
          .zg-back-btn,
          .zg-back-icon,
          .zg-rail-dot { transition: none; }
        }
      `}</style>
    </section>
  );
}