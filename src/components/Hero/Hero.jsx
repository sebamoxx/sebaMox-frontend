/**
 * Hero.jsx — "CYBER-LUXURY" / Spline 3D Stage (v10.0 — Fix + Raffinamento)
 * ══════════════════════════════════════════════════════════════════════════
 * CONCETTO (invariato)
 *   Il modello 3D <HeroSpline /> è il fondale a tutto schermo e resta il
 *   protagonista. La UI è una "nota tecnica" sovrapposta: topbar minimale in
 *   alto, blocco identità + CTA in basso, marcatori tattici agli angoli.
 *
 * TOUCH / POINTER-EVENTS (regola d'oro, ora applicata davvero)
 *   Ogni contenitore della UI ha pointer-events:none → i tap lo attraversano e
 *   raggiungono il 3D. SOLO bottoni e link hanno pointer-events:auto. Nella
 *   v9.2 i due blocchi della topbar erano erroneamente 'auto' pur non essendo
 *   interattivi: rubavano il drag al robot in tutta la fascia alta.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * BUG CORRETTI (verificati con ricerca su tutto il progetto)
 * ══════════════════════════════════════════════════════════════════════════
 * [B1] CTA MORTA. "ESPLORA IL LAB" puntava a #lab-section, id che NON esiste
 *      in nessun componente del progetto (gli unici presenti sono
 *      sezione-lavori e contact-section). L'optional chaining evitava il
 *      crash, quindi il bottone più visibile della home non faceva nulla,
 *      in silenzio. Ora: se il target manca, un warning esplicito in console
 *      (una volta sola) e ripiego su una sezione esistente, così l'utente non
 *      clicca mai a vuoto. Vedi SECTION_TARGETS: è lì che si configura.
 *
 * [B2] SCROLL IN CONFLITTO CON LENIS. Si usava scrollIntoView nativo mentre
 *      tutto il resto del codebase (App.jsx, 5 punti) scrolla con
 *      window.__lenis.scrollTo. Su desktop Lenis mantiene una posizione
 *      interna e al frame successivo riporta indietro lo scroll: il movimento
 *      si annullava o scattava. Ora si passa da Lenis quando c'è, con
 *      fallback nativo su mobile (dove Lenis è volutamente disattivato).
 *
 * [B3] RESET GLOBALE DENTRO UN COMPONENTE. Il <style> iniettava
 *      `html, body { background: #050505 }`, sovrascrivendo il #0f0a06
 *      dichiarato in index.css: la home aveva un fondo diverso dal resto del
 *      sito e il colore cambiava navigando. Rimosso: index.css è l'unica
 *      fonte di verità per html/body. Qui restano solo regole scoped.
 *
 * [B4] FOCUS INVISIBILE. outline:'none' inline senza alcuno stato alternativo:
 *      chi naviga da tastiera non vedeva dove si trovava. Aggiunto
 *      :focus-visible con anello ambra su tutti gli interattivi.
 *
 * [B5] TRANSFORM IN CONFLITTO. `.hero-cta:active { transform: scale(.98) }`
 *      sovrascriveva l'intera matrice di trasformazione che GSAP usa per
 *      l'effetto magnetico → al click il bottone saltava all'origine. Ora
 *      GSAP anima un WRAPPER esterno e il CSS scala il bottone interno: due
 *      elementi diversi, nessuna collisione.
 *
 * [B6] RECT OBSOLETO. getBoundingClientRect() veniva letto solo su mouseenter:
 *      scrollando col cursore fermo sul bottone, la calamita puntava a
 *      coordinate vecchie. Ora la misura è aggiornata dentro un rAF
 *      coalescato (una lettura per frame al massimo).
 *
 * [B7] SCRAMBLE SOVRAPPOSTI. gsap.killTweensOf(state) veniva chiamato su un
 *      oggetto appena creato, quindi non uccideva niente: passaggi rapidi del
 *      mouse accumulavano tween concorrenti sullo stesso nodo (flicker). Ora
 *      il tween è tenuto in una ref e ucciso davvero.
 *
 * [B8] 100svh SENZA FALLBACK. minHeight inline non può dichiarare due volte la
 *      stessa proprietà: su Safari < 15.4 (svh non supportato) l'hero
 *      collassava. Spostato in CSS con `100vh` prima e `100svh` dopo.
 *
 * [B9] NESSUN <h1> IN TUTTA LA HOME. Verificato: la home (HeroSection +
 *      Sections) non conteneva alcun heading di primo livello — un buco SEO e
 *      di accessibilità sulla pagina più importante del sito. Ora l'hero ha
 *      un h1 reale, che è anche il punto di forza grafico nuovo.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * RAFFINAMENTO GRAFICO (stessa identità, gerarchia diversa)
 * ══════════════════════════════════════════════════════════════════════════
 *   · GERARCHIA: prima c'era solo un paragrafo. Ora eyebrow → h1 display in
 *     due righe (la seconda in outline) → paragrafo → azione. La lettura ha
 *     un ordine, e il blocco pesa quanto il robot senza coprirlo.
 *   · REVEAL A MASCHERA: le righe del titolo salgono da dentro una clip, la
 *     stessa firma usata nelle pagine progetto → il sito parla una lingua sola.
 *   · TOPBAR: lo stato "disponibile" era testo nudo, ora è una pillola con
 *     bordo — stessa famiglia visiva delle CTA.
 *   · RAIL SIMMETRICI: coordinate a sinistra (già c'erano) + indicatore di
 *     scroll a destra, che incorniciano il 3D senza toccarlo.
 *   · GRANA: micro-texture fissa sull'hero, la stessa delle pagine progetto.
 *   · Tutto in transform/opacity, tutto disattivabile da prefers-reduced-motion.
 */

import React, { useEffect, useLayoutEffect, useRef, memo, useCallback } from 'react';
import gsap from 'gsap';
import HeroSpline from './HeroSpline';

/* ── PALETTE CYBER-LUXURY (invariata) ── */
const C = {
  void: '#050505',
  amber: '#D89C4A',
  bone: '#E8E3D8',
  mut: '#888888',
  dim: '#666666',
  green: '#7CCB6B',
  hair: 'rgba(232,227,216,0.10)',
};
const FONT = "'Outfit', 'Geist', 'Plus Jakarta Sans', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', Menlo, monospace";
const EASE = 'cubic-bezier(0.32,0.72,0,1)';

/* ══════════════════════════════════════════════════════════════════════════
   [B1] TARGET DI SCROLL — configurali qui, in un posto solo.
   ──────────────────────────────────────────────────────────────────────────
   `lab` punta a un id che al momento NON esiste nel progetto. Appena aggiungi
   id="lab-section" alla sezione del Lab, il fallback smette di attivarsi da
   solo e non serve toccare altro. Se invece il Lab non esisterà mai, cambia
   qui `id` con la sezione giusta ed elimina il fallback.
══════════════════════════════════════════════════════════════════════════ */
const SECTION_TARGETS = {
  lab:   { id: 'lab-section',    fallback: 'sezione-lavori' },
  works: { id: 'sezione-lavori', fallback: null },
};

/* Warning una volta sola per id: in sviluppo lo vedi subito, in produzione
   non intasa la console a ogni click. */
const warned = new Set();

function scrollToSection({ id, fallback }) {
  if (typeof document === 'undefined') return;

  let el = document.getElementById(id);

  if (!el) {
    if (!warned.has(id)) {
      warned.add(id);
      console.warn(
        `[Hero] Nessun elemento con id="${id}" nel DOM.` +
          (fallback ? ` Ripiego su "#${fallback}".` : ' Il CTA non ha un bersaglio.')
      );
    }
    if (fallback) el = document.getElementById(fallback);
  }
  if (!el) return;

  /* [B2] Lenis è la fonte di verità dello scroll su desktop. Su touch non
     viene nemmeno istanziato (scelta architetturale in main.jsx): lì lo
     scroll nativo è quello giusto, e il contenitore che scorre è #root. */
  const lenis = typeof window !== 'undefined' ? window.__lenis : null;
  if (lenis && typeof lenis.scrollTo === 'function') {
    lenis.scrollTo(el, { duration: 1.2 });
    return;
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ══════════════════════════════════════════════════════════════════════════
   SCRAMBLE TEXT — [B7] tween tracciato e ucciso davvero
   ──────────────────────────────────────────────────────────────────────────
   Accessibilità: il livello di layout porta il testo VERO ed è quello che
   leggono gli screen reader; l'overlay che si scompone è aria-hidden, così
   nessuno si sente leggere caratteri casuali.
══════════════════════════════════════════════════════════════════════════ */
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789◈⬡◎§#@%&+=<>';

const ScrambleSpan = memo(function ScrambleSpan({ children, style }) {
  const overlayRef = useRef(null);
  const tweenRef = useRef(null);
  const text = String(children);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return undefined;
    const host = el.parentNode;
    if (!host) return undefined;

    let reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { reduced = false; }

    const scramble = () => {
      if (reduced) {
        el.textContent = text;
        return;
      }
      // [B7] uccide il tween PRECEDENTE (prima si uccideva un oggetto nuovo)
      if (tweenRef.current) tweenRef.current.kill();

      const state = { p: 0 };
      tweenRef.current = gsap.to(state, {
        p: 1,
        duration: 0.65,
        ease: 'power2.out',
        onUpdate() {
          const revealed = Math.floor(state.p * text.length);
          el.textContent = text
            .split('')
            .map((ch, i) =>
              i < revealed
                ? ch
                : ch === ' '
                ? ' '
                : CHARSET[(Math.random() * CHARSET.length) | 0]
            )
            .join('');
        },
        onComplete() {
          el.textContent = text;
        },
      });
    };

    const onEnter = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      scramble();
    };

    host.addEventListener('pointerenter', onEnter);
    return () => {
      host.removeEventListener('pointerenter', onEnter);
      if (tweenRef.current) {
        tweenRef.current.kill();
        tweenRef.current = null;
      }
      el.textContent = text; // stato pulito allo smontaggio
    };
  }, [text]);

  return (
    <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre', ...style }}>
      {/* livello di layout: testo reale, leggibile dagli screen reader */}
      <span style={{ opacity: 0 }}>{text}</span>
      {/* livello visivo: si scompone, invisibile agli screen reader */}
      <span
        ref={overlayRef}
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, top: 0, whiteSpace: 'pre' }}
      >
        {text}
      </span>
    </span>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   GLASS CTA — [B5] wrapper magnetico + bottone: due elementi, zero conflitti
══════════════════════════════════════════════════════════════════════════ */
const SIZES = {
  md: { pad: '0.85rem 0.85rem 0.85rem 1.6rem', font: '0.8rem',  icon: '2.4rem', iconFont: '1.05rem', gap: '1rem'   },
  sm: { pad: '0.45rem 0.45rem 0.45rem 1.05rem', font: '0.68rem', icon: '1.7rem', iconFont: '0.85rem', gap: '0.7rem' },
};

const GlassCTA = memo(function GlassCTA({ label = 'ESPLORA IL LAB', onClick, size = 'md' }) {
  const wrapRef = useRef(null);
  const s = SIZES[size] || SIZES.md;

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add('(hover: hover) and (pointer: fine)', () => {
      const wrap = wrapRef.current;
      if (!wrap) return undefined; // guardia: niente crash se il nodo manca

      const strength = size === 'sm' ? 0.24 : 0.32;
      const xTo = gsap.quickTo(wrap, 'x', { duration: 0.7, ease: 'power3.out' });
      const yTo = gsap.quickTo(wrap, 'y', { duration: 0.7, ease: 'power3.out' });

      let raf = 0;
      let lastEvent = null;

      /* [B6] una sola lettura del rect per frame: sempre aggiornata anche se
         la pagina scorre sotto il cursore, senza thrash del layout. */
      const apply = () => {
        raf = 0;
        if (!lastEvent) return;
        const r = wrap.getBoundingClientRect();
        xTo((lastEvent.clientX - r.left - r.width / 2) * strength);
        yTo((lastEvent.clientY - r.top - r.height / 2) * strength);
      };

      const onMove = (e) => {
        lastEvent = e;
        if (!raf) raf = requestAnimationFrame(apply);
      };
      const onLeave = () => {
        lastEvent = null;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        gsap.to(wrap, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.3)' });
      };

      wrap.addEventListener('mousemove', onMove);
      wrap.addEventListener('mouseleave', onLeave);

      return () => {
        wrap.removeEventListener('mousemove', onMove);
        wrap.removeEventListener('mouseleave', onLeave);
        if (raf) cancelAnimationFrame(raf);
        gsap.set(wrap, { x: 0, y: 0 });
      };
    });

    return () => mm.revert();
  }, [size]);

  return (
    <span
      ref={wrapRef}
      className="hero-cta-magnet"
      style={{ display: 'inline-flex', pointerEvents: 'auto', willChange: 'transform' }}
    >
      <button
        type="button"
        onClick={onClick}
        className="hero-cta"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: s.gap,
          padding: s.pad,
          borderRadius: '5rem',
          border: '1px solid rgba(216,156,74,0.30)',
          background: 'rgba(232,227,216,0.035)',
          WebkitBackdropFilter: 'blur(12px)',
          backdropFilter: 'blur(12px)',
          color: C.bone,
          fontFamily: FONT,
          fontSize: s.font,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          cursor: 'pointer',
          boxShadow: '0 0 0 rgba(216,156,74,0)',
          transition: `border-color 0.6s ${EASE}, box-shadow 0.6s ${EASE}, background 0.6s ${EASE}, transform 0.3s ${EASE}`,
        }}
      >
        <ScrambleSpan style={{ fontFamily: FONT, letterSpacing: '0.1em' }}>{label}</ScrambleSpan>
        <span
          className="hero-cta-icon"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: s.icon,
            height: s.icon,
            borderRadius: '50%',
            background: 'rgba(216,156,74,0.12)',
            border: '1px solid rgba(216,156,74,0.35)',
            color: C.amber,
            fontSize: s.iconFont,
            lineHeight: 1,
            flexShrink: 0,
            transition: `transform 0.6s ${EASE}, background 0.6s ${EASE}`,
          }}
          aria-hidden="true"
        >
          ↗
        </span>
      </button>
    </span>
  );
});

/* ── Crosshair d'angolo (marker tattico minimale) ── */
const Crosshair = ({ style }) => (
  <div aria-hidden="true" style={{ position: 'absolute', width: 16, height: 16, pointerEvents: 'none', ...style }}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <line x1="8" y1="0" x2="8" y2="16" stroke="rgba(232,227,216,0.16)" strokeWidth="0.6" />
      <line x1="0" y1="8" x2="16" y2="8" stroke="rgba(232,227,216,0.16)" strokeWidth="0.6" />
    </svg>
  </div>
);

/* Layout effect isomorfo: evita il warning in prerender/SSR */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* ═══════════════════════════════════════════════════════════════════════════
   HERO SECTION
═══════════════════════════════════════════════════════════════════════════ */
export default function HeroSection() {
  const sectionRef = useRef(null);
  const topbarRef = useRef(null);
  const railRef = useRef(null);
  const scrollRailRef = useRef(null);
  const aboutRef = useRef(null);
  const ctaRef = useRef(null);

  /* ── INGRESSO UI ──
     Gli stati iniziali vivono in CSS sotto la classe `is-armed`, aggiunta
     prima del paint: se il JS non parte, la UI resta comunque visibile
     invece di restare invisibile per sempre. */
  useIsoLayoutEffect(() => {
    const root = sectionRef.current;
    if (!root) return undefined;

    let reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { reduced = false; }

    if (reduced) return undefined; // nessuno stato nascosto, nessun tween

    root.classList.add('is-armed');

    let rafId = 0;
    const ctx = gsap.context(() => {
      rafId = requestAnimationFrame(() => {
        const aboutKids = aboutRef.current
          ? gsap.utils.toArray(aboutRef.current.children)
          : [];

        const tl = gsap.timeline({ delay: 0.45 });

        tl.to(topbarRef.current, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' })
          .to([railRef.current, scrollRailRef.current].filter(Boolean),
              { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1 }, '-=0.7')
          /* Le righe del titolo salgono da dentro la maschera.
             ATTENZIONE: servono ENTRAMBI y e yPercent a 0. Il CSS imposta
             translateY(105%), ma getComputedStyle lo restituisce come matrice
             in PIXEL: GSAP lo interpreta come `y`, non come `yPercent`.
             Azzerare il solo yPercent lascia in piedi quei pixel e le righe
             restano fuori dalla maschera → titolo invisibile. */
          .to('.hero-h1-inner',
              { y: 0, yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.09 }, '-=0.55')
          .to(aboutKids,
              { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', stagger: 0.1 }, '-=0.9')
          .to(ctaRef.current,
              { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.6');
      });
    }, sectionRef);

    return () => {
      cancelAnimationFrame(rafId);
      ctx.revert();
      root.classList.remove('is-armed');
    };
  }, []);

  const scrollToLab = useCallback(() => scrollToSection(SECTION_TARGETS.lab), []);
  const scrollToProjects = useCallback(() => scrollToSection(SECTION_TARGETS.works), []);

  return (
    <>
      <section ref={sectionRef} className="hero-section">
        {/* ── LIVELLO BASE: il modello 3D ── */}
        <HeroSpline />

        {/* ── Grana: micro-texture coerente con le pagine progetto ── */}
        <div className="hero-grain" aria-hidden="true" />

        {/* ── Gradiente di leggibilità (alto + basso) ── */}
        <div className="hero-overlay" aria-hidden="true" />

        {/* ── Abisso (solo mobile): stacca la UI dalle gambe del robot ── */}
        <div className="hero-abyss" aria-hidden="true" />

        {/* marcatori d'angolo */}
        <Crosshair style={{ top: 10, left: 10, zIndex: 11 }} />
        <Crosshair style={{ top: 10, right: 10, zIndex: 11 }} />
        <Crosshair style={{ bottom: 10, left: 10, zIndex: 11 }} />
        <Crosshair style={{ bottom: 10, right: 10, zIndex: 11 }} />

        {/* ══ TOP BAR ══ */}
        <header ref={topbarRef} className="hero-topbar">
          {/* pointer-events:none sul gruppo → il drag del 3D passa attraverso */}
          <div className="hero-brand">
            <img
              src="/favicon.png"
              alt=""
              width="32"
              height="32"
              className="hero-logo"
              aria-hidden="true"
            />
            <span className="hero-brand-name">
              SEBAMOX<span style={{ color: C.amber }}>®</span>
            </span>
            <span className="hero-brand-sep" aria-hidden="true" />
            <span className="hero-brand-rev">REV&nbsp;3.1&nbsp;/&nbsp;2026</span>
          </div>

          {/* la pillola di stato è l'unico elemento "vivo" della topbar */}
          <div className="hero-status">
            <span className="hero-status-dot" aria-hidden="true" />
            <ScrambleSpan>DISPONIBILE PER NUOVI PROGETTI</ScrambleSpan>
          </div>
        </header>

        {/* ══ ZONA CENTRALE: rail simmetrici che incorniciano il 3D ══ */}
        <div className="hero-mid">
          <div ref={railRef} className="hero-rail hero-rail-left" aria-hidden="true">
            48.85°N&nbsp;/&nbsp;2.35°E&nbsp;—&nbsp;UNIT&nbsp;D-01
          </div>

          <div ref={scrollRailRef} className="hero-rail hero-rail-right" aria-hidden="true">
            <span className="hero-scroll-label">SCROLL</span>
            <span className="hero-scroll-track">
              <span className="hero-scroll-thumb" />
            </span>
          </div>
        </div>

        {/* ══ BLOCCO INFERIORE: identità + azioni ══ */}
        <footer className="hero-bottom">
          <div ref={aboutRef} className="hero-about">
            {/* eyebrow */}
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-rule" aria-hidden="true" />
              PROFILE&nbsp;//&nbsp;2026
            </div>

            {/* [B9] l'h1 che mancava a tutta la home */}
            <h1 className="hero-h1">
              <span className="hero-h1-line">
                <span className="hero-h1-inner">Creative Engineer</span>
              </span>
              <span className="hero-h1-line">
                <span className="hero-h1-inner hero-h1-ghost">Digital Architect</span>
              </span>
            </h1>

            <p className="hero-p">
              Creo ecosistemi digitali e interfacce di lusso per il web moderno.
            </p>

            <div className="hero-about-cta">
              <GlassCTA label="Scopri i miei progetti" size="sm" onClick={scrollToProjects} />
            </div>
          </div>

          <div ref={ctaRef} className="hero-cta-wrap">
            <GlassCTA label="ESPLORA IL LAB" onClick={scrollToLab} />
          </div>
        </footer>
      </section>

      <style>{`
        /* ══════════════════════════════════════════════════════════════
           [B3] NIENTE regole su html/body qui dentro: index.css è l'unica
           fonte di verità per lo sfondo del documento. Tutto ciò che segue
           è scoped all'hero e sparisce con lui.
        ══════════════════════════════════════════════════════════════ */

        .hero-section {
          position: relative;
          width: 100%;
          /* [B8] fallback prima, svh dopo: Safari < 15.4 usa vh e non collassa */
          min-height: 100vh;
          min-height: 100svh;
          background-color: ${C.void};
          overflow: hidden;
          display: grid;
          grid-template-rows: auto 1fr auto;
          font-family: ${FONT};
          color: ${C.bone};
        }
        .hero-section *, .hero-section *::before, .hero-section *::after { box-sizing: border-box; }

        /* Focus visibile su TUTTI gli interattivi dell'hero — [B4] */
        .hero-section button:focus-visible,
        .hero-section a:focus-visible {
          outline: 2px solid ${C.amber};
          outline-offset: 4px;
          border-radius: 5rem;
        }
        .hero-section button { outline: none; }

        /* ── STRATI DI FONDO ── */
        .hero-grain {
          position: absolute;
          inset: 0;
          z-index: 4;
          pointer-events: none;
          opacity: 0.04;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 140px 140px;
        }
        .hero-overlay {
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
          background: linear-gradient(180deg,
            rgba(5,5,5,0.74) 0%,
            rgba(5,5,5,0) 24%,
            rgba(5,5,5,0) 55%,
            rgba(5,5,5,0.62) 84%,
            rgba(5,5,5,0.94) 100%);
        }
        .hero-abyss {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 62%;
          z-index: 7;
          pointer-events: none;
          display: none;
          background: linear-gradient(180deg,
            rgba(5,5,5,0) 0%,
            rgba(5,5,5,0.55) 40%,
            rgba(5,5,5,0.9) 72%,
            ${C.void} 100%);
        }

        /* ══ TOPBAR ══ */
        .hero-topbar {
          position: relative;
          z-index: 20;
          pointer-events: none;          /* il tap attraversa e arriva al 3D */
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          padding: clamp(1.2rem, 2.4vh, 2rem) clamp(1.5rem, 5vw, 4.5rem);
          padding-left: max(clamp(1.5rem, 5vw, 4.5rem), env(safe-area-inset-left));
          padding-right: max(clamp(1.5rem, 5vw, 4.5rem), env(safe-area-inset-right));
        }
        .hero-brand {
          display: flex;
          align-items: center;
          gap: 1.1rem;
          font-family: ${MONO};
          font-size: 0.7rem;
          color: ${C.mut};
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .hero-logo {
          width: 32px; height: 32px;
          border-radius: 7px;
          border: 1px solid rgba(216,156,74,0.30);
          background-color: rgba(5,5,5,0.8);
          object-fit: contain;
          flex-shrink: 0;
          transition: border-color 0.6s ${EASE}, transform 0.6s ${EASE};
        }
        .hero-brand-name { color: ${C.bone}; font-weight: 500; letter-spacing: 0.18em; }
        .hero-brand-sep {
          width: 1px; height: 0.85rem;
          background: ${C.hair};
          display: inline-block;
          flex-shrink: 0;
        }
        .hero-brand-rev { color: ${C.dim}; }

        /* la pillola di stato: stessa famiglia visiva delle CTA */
        .hero-status {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.42rem 0.9rem;
          border-radius: 5rem;
          border: 1px solid ${C.hair};
          background: rgba(232,227,216,0.03);
          font-family: ${MONO};
          font-size: 0.66rem;
          color: ${C.mut};
          letter-spacing: 0.12em;
          text-transform: uppercase;
          white-space: nowrap;
          transition: border-color 0.6s ${EASE};
        }
        .hero-status-dot {
          display: inline-block;
          width: 7px; height: 7px;
          border-radius: 50%;
          background: ${C.green};
          box-shadow: 0 0 9px ${C.green}88;
          flex-shrink: 0;
        }

        /* ══ ZONA CENTRALE ══ */
        .hero-mid { position: relative; z-index: 10; pointer-events: none; }
        .hero-rail {
          position: absolute;
          top: 50%;
          font-family: ${MONO};
          font-size: 0.62rem;
          color: ${C.dim};
          letter-spacing: 0.3em;
          text-transform: uppercase;
        }
        .hero-rail-left {
          left: clamp(1.5rem, 4vw, 3.2rem);
          transform: translateY(-50%) rotate(180deg);
          writing-mode: vertical-rl;
        }
        .hero-rail-right {
          right: clamp(1.5rem, 4vw, 3.2rem);
          transform: translateY(-50%);
          writing-mode: vertical-rl;
          display: flex;
          align-items: center;
          gap: 0.9rem;
        }
        .hero-scroll-label { letter-spacing: 0.34em; }
        .hero-scroll-track {
          position: relative;
          display: block;
          width: 1px;
          height: 64px;
          background: ${C.hair};
          overflow: hidden;
        }
        .hero-scroll-thumb {
          position: absolute;
          top: 0; left: 0;
          width: 100%;
          height: 40%;
          background: ${C.amber};
          opacity: 0.75;
          transform: translateY(-100%);
        }

        /* ══ BLOCCO INFERIORE ══ */
        .hero-bottom {
          position: relative;
          z-index: 20;
          pointer-events: none;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 2.5rem;
          padding: clamp(1.8rem, 4.5vh, 4rem) clamp(1.5rem, 5vw, 4.5rem);
          padding-left: max(clamp(1.5rem, 5vw, 4.5rem), env(safe-area-inset-left));
          padding-right: max(clamp(1.5rem, 5vw, 4.5rem), env(safe-area-inset-right));
          padding-bottom: max(clamp(1.8rem, 4.5vh, 4rem), env(safe-area-inset-bottom));
        }
        /* max-width in rem, NON in ch: l'unità ch si misura sul font-size del
           contenitore (16px), quindi 40ch valeva ~340px — troppo stretto per
           un titolo display da 50px, che finiva per andare a capo su ogni
           parola. Qui la larghezza è indipendente dalla dimensione del testo. */
        .hero-about { pointer-events: none; max-width: clamp(18rem, 46vw, 38rem); min-width: 0; }

        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.7rem;
          font-family: ${MONO};
          font-size: 0.66rem;
          color: ${C.amber};
          letter-spacing: 0.22em;
          text-transform: uppercase;
          margin-bottom: 0.9rem;
        }
        .hero-eyebrow-rule {
          width: 1.8rem; height: 1px;
          background: ${C.amber};
          opacity: 0.7;
          display: inline-block;
          flex-shrink: 0;
        }

        /* ── IL TITOLO: il nuovo baricentro grafico ── */
        .hero-h1 {
          margin: 0 0 1.1rem;
          font-family: ${FONT};
          font-weight: 800;
          /* dimensionato per stare su UNA riga dentro .hero-about a ogni
             larghezza: "Creative Engineer" è la stringa più lunga */
          font-size: clamp(1.8rem, 3.6vw, 3.2rem);
          line-height: 1.0;
          letter-spacing: -0.035em;
          text-transform: uppercase;
          color: ${C.bone};
          text-wrap: balance;
        }
        .hero-h1-line { display: block; overflow: hidden; }
        .hero-h1-inner { display: block; }
        /* Senza il guard, un browser privo di text-stroke renderebbe la riga
           completamente invisibile (color: transparent). Con il guard degrada
           a un grigio tenue: la parola si legge sempre. */
        .hero-h1-ghost { color: rgba(232,227,216,0.30); }
        @supports (-webkit-text-stroke: 1px #000) {
          .hero-h1-ghost {
            color: transparent;
            -webkit-text-stroke: 1px rgba(232,227,216,0.42);
          }
        }

        .hero-p {
          margin: 0 0 1.6rem;
          font-family: ${FONT};
          font-size: clamp(0.92rem, 1.05vw, 1.05rem);
          font-weight: 400;
          line-height: 1.65;
          color: rgba(232,227,216,0.62);
          text-shadow: 0 1px 24px rgba(5,5,5,0.7);
          max-width: 38ch;
        }
        .hero-about-cta { display: flex; }
        .hero-cta-wrap { pointer-events: none; flex-shrink: 0; }

        /* ══ CTA ══ */
        .hero-cta:hover {
          border-color: rgba(216,156,74,0.65);
          background: rgba(216,156,74,0.07);
          box-shadow: 0 0 28px rgba(216,156,74,0.22), inset 0 0 0 1px rgba(216,156,74,0.10);
        }
        .hero-cta:hover .hero-cta-icon {
          transform: translate(3px, -3px) scale(1.06);
          background: rgba(216,156,74,0.22);
        }
        /* [B5] la scala vive sul BOTTONE, il transform magnetico sul WRAPPER:
           non si sovrascrivono più a vicenda. */
        .hero-cta:active { transform: scale(0.975); }

        /* Hover solo su puntatore fine: su touch questi stati resterebbero
           "incollati" dopo il tap. */
        @media (hover: hover) and (pointer: fine) {
          .hero-brand:hover .hero-logo {
            border-color: rgba(216,156,74,0.7);
            transform: translateY(-1px);
          }
          .hero-status:hover { border-color: rgba(216,156,74,0.35); }
        }

        /* ══ MOVIMENTO ══ */
        @media (prefers-reduced-motion: no-preference) {
          .hero-section.is-armed .hero-topbar,
          .hero-section.is-armed .hero-rail,
          .hero-section.is-armed .hero-about > *,
          .hero-section.is-armed .hero-cta-wrap {
            opacity: 0;
            transform: translateY(16px);
          }
          .hero-section.is-armed .hero-rail-left {
            transform: translateY(calc(-50% + 16px)) rotate(180deg);
          }
          .hero-section.is-armed .hero-rail-right {
            transform: translateY(calc(-50% + 16px));
          }
          .hero-section.is-armed .hero-h1-inner { transform: translateY(105%); }

          .hero-status-dot { animation: hero-pulse-dot 2.2s ease-in-out infinite; }
          .hero-scroll-thumb { animation: hero-scroll-run 2.6s ${EASE} infinite; }
        }

        @keyframes hero-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.3; transform: scale(0.55); }
        }
        @keyframes hero-scroll-run {
          0%   { transform: translateY(-100%); }
          55%  { transform: translateY(250%); }
          100% { transform: translateY(250%); }
        }

        /* ══ MOBILE (< 768px) ══ */
        @media (max-width: 768px) {
          .hero-abyss { display: block; }
          /* il 3D non cattura il touch: scroll nativo pulito */
          .hero-spline-base { pointer-events: none !important; }

          .hero-topbar { padding: 0.9rem 1.1rem; }
          .hero-bottom {
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-end;
            gap: 1.5rem;
            padding: 1.5rem 1.25rem 2.2rem;
            padding-bottom: max(2.2rem, env(safe-area-inset-bottom));
          }
          .hero-about { max-width: 100%; }
          .hero-h1 { font-size: clamp(1.75rem, 8.2vw, 2.7rem); }
          .hero-p { max-width: none; }
          .hero-cta-wrap { width: 100%; }
          .hero-cta-magnet { width: 100%; }
          .hero-cta-wrap .hero-cta { width: 100%; justify-content: space-between; }
          .hero-rail { display: none; }
        }

        @media (max-width: 480px) {
          .hero-topbar {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.7rem;
          }
          .hero-brand { gap: 0.8rem; font-size: 0.64rem; }
          .hero-brand-rev { display: none; }
          .hero-status { font-size: 0.6rem; padding: 0.36rem 0.75rem; }
        }
      `}</style>
    </>
  );
}