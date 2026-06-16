/**
 * Hero.jsx — "CYBER-LUXURY" / Spline 3D Stage (v9.2 — Mobile "Abyss" + Touch Fix)
 * ──────────────────────────────────────────────────────────────────────────
 * CONCETTO
 *   - Sfondo = modello 3D interattivo <HeroSpline /> (androide titanio, occhi LED
 *     ambra, scritta 3D "SEBAMOX") a tutto schermo: è il 100% del focus.
 *   - UI ridotta a "nota tecnica": topbar minimale in alto, blocco System/About +
 *     GlassCTA in basso. Massimo respiro e minimalismo.
 *
 * TOUCH / POINTER-EVENTS (regola d'oro)
 *   - <HeroSpline/> è il livello base (z-0) e resta INTERATTIVO: riceve tap/drag
 *     dovunque non sia coperto da un elemento interattivo.
 *   - OGNI contenitore/overlay della UI ha pointer-events:none → i tap lo
 *     attraversano e raggiungono il 3D. Solo bottoni/link/CTA hanno
 *     pointer-events:auto. Nessun overlay a tutto schermo cattura il touch.
 *
 * LAYOUT
 *   - Desktop: grid (auto / 1fr / auto). About basso-sinistra, CTA basso-destra.
 *   - Mobile (< 768px): .hero-bottom è l'UNICO contenitore UI, in colonna →
 *     prima il testo (About), poi sotto la CTA. Nessun blocco spostato in alto.
 *
 * EFFETTO ABISSO (mobile)
 *   - Un overlay sfumato (.hero-abyss) sfuma le gambe del robot nel nero pieno
 *     (#050505) nella metà bassa dello schermo → contrasto perfetto per leggere
 *     il testo bianco sovrastante. Attivo solo < 768px, pointer-events:none.
 *
 * - Desktop invariato. Ingresso GSAP + prefers-reduced-motion.
 */

import React, { useEffect, useRef, memo, useCallback } from 'react';
import gsap from 'gsap';
import HeroSpline from './HeroSpline';

/* ── PALETTE CYBER-LUXURY ── */
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

/* ── SCRAMBLE TEXT (stateless, anti-jitter) ── */
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789◈⬡◎§#@%&+=<>';
const ScrambleSpan = memo(({ children, style }) => {
  const overlayRef = useRef(null);
  const text = String(children);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const host = el.parentNode;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scramble = () => {
      if (reduced) {
        el.textContent = text;
        return;
      }
      const state = { p: 0 };
      gsap.killTweensOf(state);
      gsap.to(state, {
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
    return () => host.removeEventListener('pointerenter', onEnter);
  }, [text]);

  return (
    <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre', ...style }}>
      <span aria-hidden="true" style={{ opacity: 0 }}>
        {text}
      </span>
      <span ref={overlayRef} style={{ position: 'absolute', left: 0, top: 0, whiteSpace: 'pre' }}>
        {text}
      </span>
    </span>
  );
});

/* ── GLASS CTA — bordo 1px + glow + glassmorphism, icona "button-in-button" ──
   Prop `size`: 'md' (default) o 'sm' (compatta). Magnetica su desktop.
   pointer-events:auto → unico elemento che cattura il tap. */
const SIZES = {
  md: { pad: '0.85rem 0.85rem 0.85rem 1.6rem', font: '0.8rem', icon: '2.4rem', iconFont: '1.05rem', gap: '1rem' },
  sm: { pad: '0.45rem 0.45rem 0.45rem 1.05rem', font: '0.68rem', icon: '1.7rem', iconFont: '0.85rem', gap: '0.7rem' },
};
const GlassCTA = memo(({ label = 'ESPLORA IL LAB', onClick, size = 'md' }) => {
  const btnRef = useRef(null);
  const s = SIZES[size] || SIZES.md;

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(hover: hover) and (pointer: fine)', () => {
      const btn = btnRef.current;
      const strength = size === 'sm' ? 0.24 : 0.32;
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.7, ease: 'power3.out' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.7, ease: 'power3.out' });
      let rect = { left: 0, top: 0, width: 0, height: 0 };

      const onEnter = () => {
        rect = btn.getBoundingClientRect();
      };
      const onMove = (e) => {
        xTo((e.clientX - rect.left - rect.width / 2) * strength);
        yTo((e.clientY - rect.top - rect.height / 2) * strength);
      };
      const onLeave = () =>
        gsap.to(btn, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.3)' });

      btn.addEventListener('mouseenter', onEnter);
      btn.addEventListener('mousemove', onMove);
      btn.addEventListener('mouseleave', onLeave);
      return () => {
        btn.removeEventListener('mouseenter', onEnter);
        btn.removeEventListener('mousemove', onMove);
        btn.removeEventListener('mouseleave', onLeave);
      };
    });
    return () => mm.revert();
  }, [size]);

  return (
    <button
      ref={btnRef}
      onClick={onClick}
      className="hero-cta"
      style={{
        pointerEvents: 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        padding: s.pad,
        borderRadius: '5rem',
        border: `1px solid rgba(216,156,74,0.30)`,
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
        willChange: 'transform',
        outline: 'none',
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
          border: `1px solid rgba(216,156,74,0.35)`,
          color: C.amber,
          fontSize: s.iconFont,
          lineHeight: 1,
          flexShrink: 0,
          transition: `transform 0.6s ${EASE}, background 0.6s ${EASE}`,
        }}
      >
        ↗
      </span>
    </button>
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

/* ═══════════════════════════════════════════════════════════════════════════
   HERO SECTION
═══════════════════════════════════════════════════════════════════════════ */
export default function HeroSection() {
  const sectionRef = useRef(null);

  // refs per l'ingresso GSAP
  const topbarRef = useRef(null);
  const railRef = useRef(null);
  const aboutRef = useRef(null);
  const ctaRef = useRef(null);

  /* ── INGRESSO UI (fade-up staggerato) ── */
  useEffect(() => {
    const ctx = gsap.context(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const aboutKids = aboutRef.current ? gsap.utils.toArray(aboutRef.current.children) : [];
      const all = [topbarRef.current, railRef.current, ...aboutKids, ctaRef.current].filter(Boolean);

      if (reduced) {
        gsap.set(all, { opacity: 1, y: 0 });
        return;
      }

      gsap.set(all, { opacity: 0, y: 16 });

      const tl = gsap.timeline({ delay: 0.5 });
      tl.to(topbarRef.current, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' })
        .to(railRef.current, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.7')
        .to(aboutKids, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', stagger: 0.12 }, '-=0.45')
        .to(ctaRef.current, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.55');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  /* ── PERF — Direttiva 4 (Purge scroll listener): in questo componente NON
        esiste alcun window.addEventListener('scroll', ...) né stato di
        parallasse/topbar guidato dallo scroll. HeroSection è privo di stato
        (solo refs) → non si ri-renderizza mai dopo il mount, quindi non c'è
        diffing del Virtual DOM ad ogni pixel di scroll: nulla da rimuovere.

        Gli handler sono memoizzati con useCallback: identità stabile → le
        GlassCTA (memo) NON si ri-renderizzano nemmeno se in futuro questo
        componente acquisisse uno stato (es. scroll). (Direttiva 1) ── */
  const scrollToLab = useCallback(
    () => document.getElementById('lab-section')?.scrollIntoView({ behavior: 'smooth' }),
    []
  );
  const scrollToProjects = useCallback(
    () => document.getElementById('sezione-lavori')?.scrollIntoView({ behavior: 'smooth' }),
    []
  );

  return (
    <>
      <section
        ref={sectionRef}
        className="hero-section"
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '100dvh',
          backgroundColor: C.void,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          fontFamily: FONT,
          color: C.bone,
        }}
      >
        {/* ── LIVELLO BASE: il modello 3D (z-0, interattivo dove non coperto) ── */}
        <HeroSpline />

        {/* ── Gradient di leggibilità globale (alto + basso). pointer-events:none. ── */}
        <div
          aria-hidden="true"
          className="hero-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            pointerEvents: 'none',
            background:
              'linear-gradient(180deg, rgba(5,5,5,0.74) 0%, rgba(5,5,5,0) 24%, rgba(5,5,5,0) 58%, rgba(5,5,5,0.55) 86%, rgba(5,5,5,0.92) 100%)',
          }}
        />

        {/* ── EFFETTO ABISSO (solo mobile): sfuma le gambe del robot nel nero
               pieno → contrasto per il testo. z tra 3D e UI. pointer-events:none. */}
        <div
          aria-hidden="true"
          className="hero-abyss"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '60%',
            zIndex: 7,
            pointerEvents: 'none',
            display: 'none',
            background:
              'linear-gradient(180deg, rgba(5,5,5,0) 0%, rgba(5,5,5,0.55) 40%, rgba(5,5,5,0.9) 72%, #050505 100%)',
          }}
        />

        {/* crosshair d'angolo */}
        <Crosshair style={{ top: 10, left: 10, zIndex: 11 }} />
        <Crosshair style={{ top: 10, right: 10, zIndex: 11 }} />
        <Crosshair style={{ bottom: 10, left: 10, zIndex: 11 }} />
        <Crosshair style={{ bottom: 10, right: 10, zIndex: 11 }} />

        {/* ── TOP BAR (minimale) — contenitore pointer-events:none ── */}
        <header
          ref={topbarRef}
          className="hero-topbar"
          style={{
            position: 'relative',
            zIndex: 20,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: 'clamp(1.2rem, 2.4vh, 2rem) clamp(1.5rem, 5vw, 4.5rem)',
          }}
        >
          <div
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '1.4rem',
              fontFamily: MONO,
              fontSize: '0.7rem',
              color: C.mut,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            {/* ── NUOVO LOGO INSERITO QUI ── */}
            <img 
              src="/logo2DFigma.png" 
              alt="Sebamox Logo" 
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px', /* Bordo leggermente arrotondato */
                border: `1px solid rgba(216,156,74,0.30)`, /* Richiama il bordo della CTA */
                backgroundColor: 'rgba(5,5,5,0.8)',
                objectFit: 'contain'
              }}
            />

            <span style={{ color: C.bone, fontWeight: 500 }}>
              SEBAMOX<span style={{ color: C.amber }}>®</span>
            </span>
            <span style={{ width: 1, height: '0.8rem', background: C.hair, display: 'inline-block' }} />
            <span style={{ color: C.dim }}>REV&nbsp;3.1&nbsp;/&nbsp;2026</span>
          </div>

          <div
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontFamily: MONO,
              fontSize: '0.7rem',
              color: C.mut,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: C.green,
                boxShadow: `0 0 9px ${C.green}88`,
                animation: 'hero-pulse-dot 2.2s ease-in-out infinite',
                flexShrink: 0,
              }}
            />
            <ScrambleSpan>DISPONIBILE PER NUOVI PROGETTI</ScrambleSpan>
          </div>
        </header>

        {/* ── ZONA CENTRALE: libera per il modello 3D (solo rail verticale).
               Contenitore pointer-events:none → il centro resta tappabile. ── */}
        <div style={{ position: 'relative', zIndex: 10, pointerEvents: 'none' }}>
          <div
            ref={railRef}
            aria-hidden="true"
            className="hero-rail"
            style={{
              position: 'absolute',
              left: 'clamp(1.5rem, 4vw, 3.2rem)',
              top: '50%',
              transform: 'translateY(-50%) rotate(180deg)',
              writingMode: 'vertical-rl',
              fontFamily: MONO,
              fontSize: '0.62rem',
              color: C.dim,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
            }}
          >
            48.85°N&nbsp;/&nbsp;2.35°E&nbsp;—&nbsp;UNIT&nbsp;D-01
          </div>
        </div>

        {/* ── BLOCCO INFERIORE: UNICO contenitore UI (About + CTA).
               Contenitore pointer-events:none; solo le CTA sono interattive. ── */}
        <footer
          className="hero-bottom"
          style={{
            position: 'relative',
            zIndex: 20,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '2rem',
            padding: 'clamp(1.8rem, 4.5vh, 4rem) clamp(1.5rem, 5vw, 4.5rem)',
          }}
        >
          {/* SINISTRA / (mobile: in alto nello stack): blocco System / About */}
          <div ref={aboutRef} className="hero-about" style={{ pointerEvents: 'none', maxWidth: '34ch' }}>
            {/* Riga 1 — label */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.7rem',
                fontFamily: MONO,
                fontSize: '0.66rem',
                color: C.amber,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                marginBottom: '1rem',
              }}
            >
              <span style={{ width: '1.8rem', height: 1, background: C.amber, opacity: 0.7, display: 'inline-block', flexShrink: 0 }} />
              PROFILE&nbsp;//&nbsp;2026
            </div>

            {/* Riga 2 — descrizione */}
            <p
              style={{
                margin: '0 0 1.5rem',
                fontFamily: FONT,
                fontSize: 'clamp(0.92rem, 1.05vw, 1.05rem)',
                fontWeight: 400,
                lineHeight: 1.6,
                color: C.bone,
                textShadow: '0 1px 24px rgba(5,5,5,0.7)',
              }}
            >
              Creative Engineer &amp; Digital Architect. Creo ecosistemi digitali e
              interfacce di lusso per il web moderno.
            </p>

            {/* Riga 3 — micro-CTA */}
            <div style={{ display: 'flex' }}>
              <GlassCTA label="Scopri i miei progetti" size="sm" onClick={scrollToProjects} />
            </div>
          </div>

          {/* DESTRA / (mobile: sotto il testo): GlassCTA LAB */}
          <div ref={ctaRef} className="hero-cta-wrap" style={{ pointerEvents: 'none', flexShrink: 0 }}>
            <GlassCTA label="ESPLORA IL LAB" onClick={scrollToLab} />
          </div>
        </footer>
      </section>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: ${C.void}; color: ${C.bone}; }

        @keyframes hero-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.55); }
        }

        /* CTA: glow ambra al passaggio + icona che scatta in diagonale */
        .hero-cta:hover {
          border-color: rgba(216,156,74,0.65);
          background: rgba(216,156,74,0.07);
          box-shadow: 0 0 28px rgba(216,156,74,0.22), inset 0 0 0 1px rgba(216,156,74,0.10);
        }
        .hero-cta:hover .hero-cta-icon {
          transform: translate(3px, -3px) scale(1.06);
          background: rgba(216,156,74,0.22);
        }
        .hero-cta:active { transform: scale(0.98); }

        /* ── MOBILE (< 768px): UI tutta in basso, colonna (testo → CTA) ──────────
           .hero-bottom è l'unico contenitore. L'effetto Abisso (.hero-abyss) si
           accende per staccare la UI dal robot. Desktop invariato. */
        @media (max-width: 768px) {
          .hero-abyss { display: block !important; }
          /* FIX VITALE: su mobile il 3D NON cattura il touch → scroll nativo + il robot smette di seguire il dito. Desktop resta auto. */
          .hero-spline-base { pointer-events: none !important; }
          .hero-topbar { padding: 0.9rem 1.1rem !important; }
          .hero-bottom {
            flex-direction: column !important;
            align-items: flex-start !important;
            justify-content: flex-end !important;
            gap: 1.6rem !important;
            padding: 1.5rem 1.25rem 2.2rem !important;
          }
          .hero-about { max-width: 100% !important; }
          .hero-cta-wrap { width: 100% !important; }
          .hero-cta-wrap .hero-cta { display: flex !important; width: 100% !important; justify-content: space-between !important; }
          .hero-rail { display: none !important; }
        }
        @media (max-width: 480px) {
          .hero-topbar { flex-direction: column !important; align-items: flex-start !important; gap: 0.6rem !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          [style*="hero-pulse-dot"] { animation: none !important; }
        }
      `}</style>
    </>
  );
}