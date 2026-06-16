import { useEffect, useRef, memo, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link, useNavigate } from 'react-router-dom';
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
   COSTANTI DEL MONDO 3D
═══════════════════════════════════════════════════════════════ */
const SPACING     = 1600;  // distanza Z tra un monolite e il successivo (px)
const START       = 1200;  // distanza Z del primo monolite dal piano focale
const FAR_FADE    = 3000;  // distanza oltre la quale un monolite è invisibile
const BEHIND_FADE = 520;   // px dietro la camera entro cui svanisce (< perspective!)
const FOCUS_RANGE = 420;   // |depth| entro cui un monolite è "in focus"
const TOTAL_Z     = START + (N - 1) * SPACING; // corsa totale del mondo
const PERSPECTIVE = 1200;  // px — BEHIND_FADE deve restare sotto questo valore

/* ═══════════════════════════════════════════════════════════════
   QUALITY GOVERNOR — stesso pattern del preloader
═══════════════════════════════════════════════════════════════ */
const QUALITY_TIERS = [
  { dprCap: 2.0, particles: 120 },
  { dprCap: 1.5, particles: 72  },
  { dprCap: 1.0, particles: 40  },
];
const FRAME_WINDOW = 90;
const FRAME_BUDGET = 19; // ms medi → oltre, si degrada di un tier

/* ═══════════════════════════════════════════════════════════════
   SPRITE GLOW PRE-RENDERIZZATI
   ───────────────────────────────────────────────────────────────
   createRadialGradient per frame = allocazione + costo GPU.
   Soluzione: il bagliore viene disegnato UNA volta su un canvas
   offscreen e poi stampato con drawImage (blit puro, economico).
═══════════════════════════════════════════════════════════════ */
function makeGlowSprite(size, r, g, b) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const grad = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.00, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.18, `rgba(${r},${g},${b},0.55)`);
  grad.addColorStop(0.45, `rgba(${r},${g},${b},0.12)`);
  grad.addColorStop(1.00, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, size, size);
  return c;
}

/* ═══════════════════════════════════════════════════════════════
   SINGULARITY — Canvas 2D fisso al centro della scena
   ───────────────────────────────────────────────────────────────
   props (refs numerici, MAI state → zero re-render React):
   - speedRef : 0..1, velocità di scroll normalizzata e smorzata
   - reduced  : prefers-reduced-motion → frame statico
═══════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════
   SINGULARITY v2 — "THE VOID CORE" (Buco Nero Geometrico)
   ────────────────────────────────────────────────────────────────────
   ISTRUZIONI: questo blocco SOSTITUISCE integralmente il componente
   `Singularity` dentro WorksArchive.jsx (da `const Singularity = memo`
   fino alla chiusura `});`). Usa gli stessi helper module-scope già
   presenti nel file: T, QUALITY_TIERS, FRAME_WINDOW, FRAME_BUDGET,
   makeGlowSprite, memo/useRef/useEffect.

   COSA CAMBIA RISPETTO ALLA v1:
   - ELIMINATO il pilastro di luce verticale (pillarGrad e relativo
     fillRect) — via anche dal setup().
   - ELIMINATI coreSprite (il nucleo non è più luce ma assenza),
     TILT, SQUASH e drawDiskHalf (niente più disco ellittico).
   - NUOVO centro: un cerchio nero assoluto (#050505) che COPRE
     tutto ciò che gli passa sotto → nucleo impenetrabile.
   - NUOVI anelli concentrici hairline (1px), alcuni spezzati via
     dash-array, in rotazione lenta (lineDashOffset — vedi nota).
   - Particelle in orbita perfettamente CIRCOLARE attorno al Void,
     che sfumano verso l'esterno, con scia tangenziale + centrifuga
     proporzionale alla velocità di scroll.

   INVARIATI: Quality Governor, resize intelligente, reduced-motion,
   inerzia di speedRef, cleanup. Zero WebGL, singolo Canvas 2D.
════════════════════════════════════════════════════════════════════ */
const Singularity = memo(({ speedRef, reduced }) => {
  const cvRef = useRef(null);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d', { alpha: true }); // sopra il nero della sezione

    /* ── Governor state (invariato) ─────────────────────────── */
    const isMobile = window.innerWidth < 768;
    let tierIdx = isMobile ? 1 : 0;
    let tier    = QUALITY_TIERS[tierIdx];
    let frameAcc = 0, frameCount = 0;

    let W = 0, H = 0, dpr = 1;

    /* ── Unico sprite superstite: alone ambra tenue di profondità.
       Il Void non emette luce — l'alone è il "calore" residuo dello
       spazio attorno, quasi impercettibile.                       */
    const haloSprite = makeGlowSprite(256, 216, 156, 74);

    /* ── ANELLI CONCENTRICI — configurazione statica ──────────
       m     : moltiplicatore del raggio del Void
       dash  : [tratto, vuoto] in px — null = anello pieno
       color : colore hairline
       speed : velocità/direzione di rotazione del pattern dash
               (gli anelli pieni non ruotano: sono invarianti)    */
    const RINGS = [
      { m: 1.00, dash: null,     color: T.boneDim,    baseA: 0.16, speed:  0    }, // event horizon (bordo del Void)
      { m: 1.22, dash: [2, 10],  color: T.boneDim,    baseA: 0.30, speed:  0.22 }, // punteggiato fine, orario
      { m: 1.45, dash: [46, 30], color: T.amberGhost, baseA: 0.85, speed: -0.14 }, // segmenti lunghi, antiorario
      { m: 1.78, dash: [1, 16],  color: T.amberGhost, baseA: 0.60, speed:  0.08 }, // pulviscolo radente, lentissimo
    ];

    /* ── PARTICELLE — orbita circolare attorno al Void ────────
       pA = angolo orbitale corrente (rad)
       p01 = raggio normalizzato 0..1 → mappato fuori dal Void
       pS = velocità angolare: ∝ 1/√r ("Keplero" — le orbite
            interne sono più veloci, come un vero disco)
       pZ = peso individuale (varia la lunghezza della scia)      */
    const MAX_P = QUALITY_TIERS[0].particles;
    const pA  = new Float32Array(MAX_P);
    const p01 = new Float32Array(MAX_P);
    const pS  = new Float32Array(MAX_P);
    const pZ  = new Float32Array(MAX_P);
    for (let i = 0; i < MAX_P; i++) {
      pA[i]  = Math.random() * Math.PI * 2;
      p01[i] = Math.random();                                  // 0 = bordo Void, 1 = esterno
      pS[i]  = (0.25 + Math.random() * 0.45) / Math.sqrt(1 + p01[i] * 1.4)
               * (Math.random() > 0.85 ? -1 : 1);              // ~15% controrotanti
      pZ[i]  = 0.8 + Math.random() * 1.2;
    }

    const setup = () => {
      W   = window.innerWidth;
      H   = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, tier.dprCap);
      cv.width  = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      /* NOTA: niente più pillarGrad qui — eliminato col pilastro */
    };
    setup();

    let raf = 0, prevTs = 0;
    let ringPhase = 0; // accumulatore di rotazione del pattern dash
    let breath    = 0; // respiro lentissimo degli anelli
    let sp = 0;        // velocità smorzata (inerzia: si raffredda da solo)

    const draw = (ts) => {
      raf = requestAnimationFrame(draw);
      if (!prevTs) prevTs = ts;
      const dt = Math.min((ts - prevTs) / 1000, 0.05);
      prevTs = ts;

      /* ── Governor (invariato) ─────────────────────────────── */
      frameAcc += dt * 1000;
      frameCount++;
      if (frameCount >= FRAME_WINDOW) {
        const avg = frameAcc / frameCount;
        frameAcc = 0; frameCount = 0;
        if (avg > FRAME_BUDGET && tierIdx < QUALITY_TIERS.length - 1) {
          tierIdx++;
          tier = QUALITY_TIERS[tierIdx];
          setup();
        }
      }

      /* ── Inerzia: sp insegue speedRef, accende veloce (×9) e
         si raffredda lento (×2.2) — il Void "digerisce" l'energia */
      const target = Math.min(Math.abs(speedRef.current), 1);
      sp += (target - sp) * Math.min(1, dt * (target > sp ? 9 : 2.2));

      ctx.clearRect(0, 0, W, H);

      const cx = W * 0.5;
      const cy = H * 0.5;
      /* Raggio del Void: 15% del lato corto del viewport →
         su mobile portrait si aggancia alla larghezza e resta
         sempre proporzionato, mai invadente.                    */
      const voidR = Math.min(W, H) * 0.15;

      /* Avanzamento orbite: a riposo lente (0.3 rad/s di base),
         in scroll veloce fino a ~3.8× — il fattore pS[i] individuale
         mantiene il differenziale kepleriano tra le orbite        */
      const adv = dt * (0.30 + sp * 3.5);
      const nP = tier.particles;
      for (let i = 0; i < nP; i++) pA[i] += adv * pS[i];

      /* Rotazione del pattern degli anelli: stessa filosofia —
         lenta a riposo, furiosa sotto scroll                     */
      ringPhase += dt * (1 + sp * 7);
      breath    += dt * 0.5;
      /* Respiro: ±1.2% sul raggio degli anelli, periodo ~12.5s —
         sotto la soglia di attenzione cosciente, sopra quella
         della sensazione di "vivo"                               */
      const breathScale = 1 + Math.sin(breath) * 0.012;

      /* ════ 1 · ALONE DI PROFONDITÀ (dietro a tutto) ═════════
         Ambra quasi subliminale: 4% a riposo, 12% a piena velocità.
         Niente "luce esplosiva" — è temperatura, non emissione.  */
      const haloR = voidR * 3.2;
      ctx.globalAlpha = 0.04 + sp * 0.08;
      ctx.drawImage(haloSprite, cx - haloR, cy - haloR, haloR * 2, haloR * 2);

      /* ════ 2 · EVENT HORIZON PARTICLES ══════════════════════
         Orbita circolare pura: P = C + r·(cos a, sin a).
         Raggio: r = voidR · (1.1 + p01·1.3) → fascia 1.1–2.4 voidR,
         SEMPRE fuori dal Void.
         Scia = tangente + componente centrifuga:
           tangente  t̂ = (-sin a, cos a)·segno(velocità orbitale)
           radiale   r̂ = (cos a, sin a)
           scia = t̂·(1 + sp·14·pZ) + r̂·(sp²·22)
         La parte radiale cresce col QUADRATO di sp → a bassa
         velocità la scia è puramente orbitale (elegante), in
         scroll violento le particelle "sbavano" verso l'esterno
         come materia strappata via dalla centrifuga.             */
      ctx.lineWidth = 1;
      ctx.strokeStyle = T.amber;
      for (let i = 0; i < nP; i++) {
        const a    = pA[i];
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        const r    = voidR * (1.1 + p01[i] * 1.3);
        const x    = cx + cosA * r;
        const y    = cy + sinA * r;

        const dir  = pS[i] >= 0 ? 1 : -1;          // verso orbitale
        const stT  = 1 + sp * 14 * pZ[i];          // stretch tangenziale (motion blur)
        const stR  = sp * sp * 22;                  // smear centrifugo (quadratico)

        /* Alpha: sfuma verso l'esterno (1−p01·0.72) e si accende
           con la velocità (0.35→1.0)                             */
        ctx.globalAlpha = (0.14 + 0.38 * (1 - p01[i] * 0.72)) * (0.35 + sp * 0.65);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          x + (-sinA * dir) * stT + cosA * stR,
          y + ( cosA * dir) * stT + sinA * stR
        );
        ctx.stroke();
      }

      /* ════ 3 · THE VOID — il cerchio nero assoluto ══════════
         Disegnato DOPO alone e particelle: qualsiasi scia che
         smeari verso l'interno viene inghiottita → l'illusione
         di un nucleo impenetrabile è geometricamente garantita. */
      ctx.globalAlpha = 1;
      ctx.fillStyle = T.void;
      ctx.beginPath();
      ctx.arc(cx, cy, voidR, 0, Math.PI * 2);
      ctx.fill();

      /* ════ 4 · ANELLI CONCENTRICI (sopra il Void) ═══════════
         La "rotazione" degli anelli spezzati è lineDashOffset:
         far scorrere il pattern lungo la circonferenza È una
         rotazione, senza translate/rotate del contesto (un arc
         è invariante per rotazione — costo: zero trasformazioni).
         offset = fase · velocità · 60px (60 ≈ px di pattern/sec) */
      for (let k = 0; k < RINGS.length; k++) {
        const ring = RINGS[k];
        const rr = voidR * ring.m * breathScale;
        ctx.globalAlpha = ring.baseA * (0.7 + sp * 0.9); // si accendono in velocità
        ctx.strokeStyle = ring.color;
        if (ring.dash) {
          ctx.setLineDash(ring.dash);
          ctx.lineDashOffset = ringPhase * ring.speed * 60;
        } else {
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]); // reset: non sporcare il prossimo frame
      ctx.globalAlpha = 1;
    };

    if (reduced) {
      draw(16);                  // un solo frame statico
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(draw);
    }

    /* ── Resize intelligente (invariato) ─────────────────────── */
    let prevW = window.innerWidth;
    let prevOrient = window.innerWidth > window.innerHeight ? 'l' : 'p';
    let resizeTimer = 0;
    const handleResize = () => {
      const nw = window.innerWidth;
      const no = window.innerWidth > window.innerHeight ? 'l' : 'p';
      if (Math.abs(nw - prevW) <= 30 && no === prevOrient) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        prevW = nw; prevOrient = no;
        setup();
        if (reduced) draw(16);
      }, 200);
    };

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleResize);
      ro.observe(document.documentElement);
    } else {
      window.addEventListener('resize', handleResize, { passive: true });
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', handleResize);
    };
  }, [speedRef, reduced]);

  return (
    <canvas
      ref={cvRef}
      aria-hidden
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        zIndex: 2, pointerEvents: 'none',
      }}
    />
  );
});

/* ═══════════════════════════════════════════════════════════════
   MONOLITH — scheda di vetro spaziale (DOM puro, vetro sintetico)
   Statica: posizione 3D impostata UNA volta (gsap.set).
   Dinamica: solo opacity / visibility / classe .is-focus.
═══════════════════════════════════════════════════════════════ */
const Monolith = memo(({ project, refCb, onOpen }) => (
  <article
    ref={refCb}
    className={`zg-monolith ${project.wide ? 'zg-wide' : ''}`}
    style={{ visibility: 'hidden', opacity: 0 }}
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
═══════════════════════════════════════════════════════════════ */
export default function WorksArchive() {
  const sectionRef  = useRef(null);
  const worldRef    = useRef(null);
  const counterRef  = useRef(null);
  const hintRef     = useRef(null);
  const railRefs    = useRef([]);
  const monolithEls = useRef([]);
  const tNavigate = useTransitionNavigate();

  /* ── SYS.RETURN — ritorno chirurgico a #sezione-lavori ─────────────
   Niente polling qui: la HomePage ha già la pipeline completa
   (veil nero + scrollToElementWhenReady) che:
   1. alza il veil PRIMA del paint → la Hero non si vede mai
   2. aspetta l'elemento lazy via MutationObserver (niente interval)
   3. aspetta il layout stabile (ResizeObserver su body) → coordinata
      esatta anche su mobile con immagini/font in caricamento
   4. scrolla con Lenis immediate:true (o nativo su mobile)
   5. abbassa il veil e pulisce lo state (history.replaceState)
   Quella pipeline si attiva SOLO se location.state contiene il
   target: il vecchio navigate('/') senza state cadeva nel ramo
   else → lenis.scrollTo(0) → Hero. Tutto qui.                      */
  const handleReturnClick = (e) => {
    e.preventDefault();
    tNavigate('/', { state: { scrollTo: 'sezione-lavori' } });
  };

  const handleOpenProject = useCallback((e, link) => {
    e.preventDefault();
    if (!link || link === '#') return;   // progetti senza pagina: no-op
    tNavigate(link);
  }, [tNavigate]);

  /* Canale velocity verso la Singolarità — ref, mai state */
  const speedRef = useRef(0);

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const section = sectionRef.current;
    const world   = worldRef.current;
    if (!section || !world) return;

    const isMobile = window.innerWidth < 768;

    const gsapCtx = gsap.context(() => {

      /* ── Posizionamento statico dei monoliti ────────────────
         Quinconce: sinistra / destra alternati, leggera rotazione
         Y verso il centro, offset verticale alternato per ritmo.
         Ricalcolato SOLO al resize (dipende dalla larghezza).    */
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

      /* ── Setter ad alta frequenza ────────────────────────────
         quickSetter/quickTo sullo STESSO elemento .world:
         GSAP fonde z + skewY in un'unica matrice di transform —
         mai scrivere style.transform a mano in parallelo.        */
      const zSet   = gsap.quickSetter(world, 'z', 'px');
      const skewTo = gsap.quickTo(world, 'skewY', {
        duration: 0.55, ease: 'power3.out',
      });
      gsap.set(world, { force3D: true });

      let lastFocus  = -1;
      let lastRail   = -1;
      let hintHidden = false;
      let lastScrollTs = 0;

      /* ── Aggiornamento per-frame del mondo ─────────────────── */
      const applyWorld = (progress, velocity) => {
        const worldZ = progress * TOTAL_Z;
        zSet(worldZ);

        /* Velocity → skew magnetico + energia Singolarità */
        const v = Math.max(-1, Math.min(1, velocity / 3200));
        speedRef.current = Math.abs(v);
        if (!reducedMotion) skewTo(v * -3.2);
        lastScrollTs = performance.now();

        /* Hint "scroll to fly" sparisce al primo volo */
        if (!hintHidden && progress > 0.012 && hintRef.current) {
          hintHidden = true;
          gsap.to(hintRef.current, { opacity: 0, duration: 0.8, ease: 'power2.out' });
        }

        /* Per-monolith: depth → opacity + culling + focus */
        let focusIdx = -1;
        for (let i = 0; i < N; i++) {
          const el = monolithEls.current[i];
          if (!el) continue;
          const d = worldZ - (START + i * SPACING); // 0 = piano focale
          let op;
          if (d > 0) {
            op = 1 - d / BEHIND_FADE;               // sta passando dietro
          } else {
            const t = 1 + d / FAR_FADE;             // emerge dall'oscurità
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

        /* Toggle .is-focus solo quando cambia (niente churn DOM) */
        if (focusIdx !== lastFocus) {
          if (lastFocus >= 0) monolithEls.current[lastFocus]?.classList.remove('is-focus');
          if (focusIdx >= 0)  monolithEls.current[focusIdx]?.classList.add('is-focus');
          lastFocus = focusIdx;
        }

        /* Rail laterale + counter */
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

      /* ── ScrollTrigger: lo scrub del volo ────────────────────
         Sticky layer in CSS (niente pin-spacer) + un trigger che
         mappa il progresso della sezione su translateZ del mondo.
         Funziona con Lenis perché lo scroll resta NATIVO.        */
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: self => applyWorld(self.progress, self.getVelocity()),
      });

      /* ── Decadimento skew quando lo scroll si ferma ──────────
         ScrollTrigger.onUpdate tace a scroll fermo: un ticker
         leggerissimo riporta lo skew a zero dopo 140ms di quiete. */
      const calm = () => {
        if (performance.now() - lastScrollTs > 140 && speedRef.current > 0.001) {
          speedRef.current = 0;
          if (!reducedMotion) skewTo(0);
        }
      };
      gsap.ticker.add(calm);

      /* Primo paint (prima di qualsiasi scroll) */
      applyWorld(0, 0);

      /* ── Resize: ricolloca i monoliti (width-dependent) ────── */
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

      /* Cleanup interno al context */
      return () => {
        gsap.ticker.remove(calm);
        clearTimeout(rTimer);
        window.removeEventListener('resize', onResize);
      };
    }, section);

    /* gsapCtx.revert() uccide ScrollTrigger, quickTo, set e ticker */
    return () => gsapCtx.revert();
  }, [reducedMotion]);

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
      {/* ── LAYER STICKY: la "camera" ─────────────────────────── */}
      <div className="zg-camera">

        {/* Singolarità — fissa al centro, sotto i monoliti */}
        <Singularity speedRef={speedRef} reduced={reducedMotion} />

        {/* Vignettatura statica */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0,0,0,0.75) 100%)',
        }} />

        {/* ── VIEWPORT 3D ───────────────────────────────────── */}
        <div className="zg-viewport">
          <div ref={worldRef} className="zg-world">
            {PROJECTS.map((p, i) => (
              <Monolith
                key={p.id}
                project={p}
                onOpen={handleOpenProject}
                refCb={el => { monolithEls.current[i] = el; }}
              />
            ))}
          </div>
        </div>

        {/* ── HUD: top bar ──────────────────────────────────── */}
        <header className="zg-hud-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(1rem, 3vw, 2rem)' }}>
            
            {/* Pulsante Back to Home con onClick personalizzato */}
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

        {/* ── HUD: rail laterale di posizione ───────────────── */}
        <nav className="zg-rail" aria-label="Posizione nell'archivio">
          {PROJECTS.map((p, i) => (
            <span
              key={p.id}
              ref={el => { railRefs.current[i] = el; }}
              className={`zg-rail-dot ${i === 0 ? 'is-here' : ''}`}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
          ))}
        </nav>

        {/* ── HUD: hint iniziale ─────────────────────────────── */}
        <div ref={hintRef} className="zg-hint" aria-hidden>
          SCROLL TO FLY — Z-AXIS NAVIGATION
        </div>
      </div>

      <style>{`
        /* ═══ CAMERA (sticky, niente pin-spacer GSAP) ═══════════
           100dvh segue la URL bar iOS; fallback 100vh implicito. */
        .zg-camera {
          position: sticky;
          top: 0;
          height: 100svh;
          height: 100svh;
          overflow: hidden;
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