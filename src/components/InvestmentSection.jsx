/**
 * InvestmentSection.jsx — "INVESTMENT // EARLY STAGE" (v1.1)
 * ═══════════════════════════════════════════════════════════════════════════
 * DIREZIONE ARTISTICA: Swiss-Cyber Brutalist · High-End Tech
 *   Niente tabella SaaS a 3 colonne: due SCENARI DI PROGETTO come righe di un
 *   blueprint architettonico. Grid asimmetrica, hairline 1px, tipografia
 *   rigorosa, prezzi in mono con effetto decodifica.
 *
 * AGGIORNAMENTO v1.1:
 *   - Introdotto il token dinamico .inv-ai-token associato al colore arancio C.acc.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useRef, memo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ── DESIGN TOKENS ─────────────────────────────────────────────────────── */
const C = {
  bg:    '#030201',
  panel: '#060403',
  txt:   '#F0E6D3',
  mut:   'rgba(240,230,211,0.38)',
  dim:   'rgba(240,230,211,0.16)',
  hair:  'rgba(240,230,211,0.08)',
  acc:   '#F4A261',                 // arancio — interazione / prezzo / AI
  green: '#4AF626',                 // verde — sistema / Python token
  accBg: 'rgba(244,162,97,0.05)',   // tinta hover delle righe
};
const FONT = "'Cabinet Grotesk','Syne','Geist','Outfit',system-ui,sans-serif";
const MONO = "'JetBrains Mono','Space Mono',ui-monospace,Menlo,monospace";

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ════════════════════════════════════════════════════════════════════════
   PREZZO CON DECODIFICA — scramble solo delle CIFRE, lunghezza costante.
════════════════════════════════════════════════════════════════════════ */
const ScramblePrice = memo(({ text }) => {
  const elRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const reduced = prefersReduced();
    const DIGITS = '0123456789';
    const isDigit = (ch) => ch >= '0' && ch <= '9';

    const scramble = () => {
      if (reduced) return;
      const state = { p: 0 };
      gsap.killTweensOf(state);
      gsap.to(state, {
        p: 1, duration: 0.7, ease: 'power2.out',
        onUpdate() {
          const revealed = Math.floor(state.p * text.length);
          el.textContent = text.split('').map((ch, i) =>
            !isDigit(ch) || i < revealed ? ch : DIGITS[(Math.random() * 10) | 0]
          ).join('');
        },
        onComplete() { el.textContent = text; },
      });
    };
    apiRef.current = scramble;

    const onDecode = () => scramble();
    el.addEventListener('inv:decode', onDecode);
    return () => { el.removeEventListener('inv:decode', onDecode); gsap.killTweensOf({}); };
  }, [text]);

  return <span ref={elRef} className="inv-price-value" data-decode>{text}</span>;
});

/* ════════════════════════════════════════════════════════════════════════
   CTA MAGNETICA
════════════════════════════════════════════════════════════════════════ */
const MagneticCTA = memo(({ label, onClick }) => {
  const btnRef = useRef(null);
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(hover: hover) and (pointer: fine)', () => {
      const btn = btnRef.current;
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.65, ease: 'power3.out' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.65, ease: 'power3.out' });
      const onMove = (e) => {
        const r = btn.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.38);
        yTo((e.clientY - r.top - r.height / 2) * 0.38);
      };
      const onLeave = () => gsap.to(btn, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.3)' });
      const onPress = () => gsap.to(btn, { scale: 0.94, duration: 0.1 });
      const onRelease = () => gsap.to(btn, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      btn.addEventListener('mousemove', onMove);
      btn.addEventListener('mouseleave', onLeave);
      btn.addEventListener('mousedown', onPress);
      btn.addEventListener('mouseup', onRelease);
      return () => {
        btn.removeEventListener('mousemove', onMove);
        btn.removeEventListener('mouseleave', onLeave);
        btn.removeEventListener('mousedown', onPress);
        btn.removeEventListener('mouseup', onRelease);
      };
    });
    return () => mm.revert();
  }, []);
  return (
    <button ref={btnRef} onClick={onClick} data-cursor className="inv-cta-btn">
      <span className="inv-cta-inner">
        {label}
        <span className="inv-cta-arrow">↗</span>
      </span>
    </button>
  );
});

/* ════════════════════════════════════════════════════════════════════════
   RIGA SCENARIO — blueprint row asimmetrica.
════════════════════════════════════════════════════════════════════════ */
const ScenarioRow = memo(({ index, title, audience, features, price }) => {
  const rowRef = useRef(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const priceEl = row.querySelector('[data-decode]');
    const onEnter = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (priceEl) priceEl.dispatchEvent(new CustomEvent('inv:decode'));
    };
    row.addEventListener('pointerenter', onEnter);
    return () => row.removeEventListener('pointerenter', onEnter);
  }, []);

  return (
    <article ref={rowRef} className="inv-row" data-cursor>
      <span className="inv-row-line" aria-hidden="true" />

      <div className="inv-row-grid">
        {/* COL 1 — indice blueprint */}
        <div className="inv-col-index">
          <span className="inv-index">{index}</span>
          <span className="inv-index-label">SCENARIO</span>
        </div>

        {/* COL 2 — titolo + destinatario */}
        <div className="inv-col-main">
          <h3 className="inv-row-title">{title}</h3>
          <p className="inv-row-audience">{audience}</p>
        </div>

        {/* COL 3 — features come specifica tecnica */}
        <ul className="inv-col-features">
          {features.map((f, i) => (
            <li key={i} className="inv-feature">
              <span className="inv-feature-cross" aria-hidden="true">+</span>
              
              {/* RENDERING DELLE FEATURE COMPRESI I TOKEN SPECIALI */}
              {f.python ? (
                <span>
                  {f.pre}
                  <span className="inv-python-token">PYTHON</span>
                  {f.post}
                </span>
              ) : f.ai ? (
                <span>
                  {f.pre}
                  <span className="inv-ai-token">AI</span>
                  {f.post}
                </span>
              ) : (
                <span>{f.text}</span>
              )}
            </li>
          ))}
        </ul>

        {/* COL 4 — prezzo + freccia */}
        <div className="inv-col-price">
          <span className="inv-price-label">STARTING AT</span>
          <ScramblePrice text={price} />
          <span className="inv-row-arrow" aria-hidden="true">→</span>
        </div>
      </div>
    </article>
  );
});

/* ════════════════════════════════════════════════════════════════════════
   SEZIONE PRINCIPALE
════════════════════════════════════════════════════════════════════════ */
export default function InvestmentSection() {
  const sectionRef = useRef(null);

  React.useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (prefersReduced()) return;

      const lines = gsap.utils.toArray('.inv-title-line');
      const hairs = gsap.utils.toArray('.inv-row-line, .inv-head-line');
      const rows = gsap.utils.toArray('.inv-row-grid');
      const meta = gsap.utils.toArray('.inv-head-meta, .inv-intro');
      const cta = sectionRef.current.querySelector('.inv-ctablock');

      gsap.set(lines, { yPercent: 112 });
      gsap.set(hairs, { scaleX: 0, transformOrigin: 'left center' });
      gsap.set(rows, { autoAlpha: 0, y: 34 });
      gsap.set(meta, { autoAlpha: 0, y: 16 });
      gsap.set(cta, { autoAlpha: 0, y: 34 });

      gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', once: true },
        defaults: { ease: 'power4.out' },
      })
        .to(meta, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1 }, 0)
        .to(lines, { yPercent: 0, duration: 1.05, stagger: 0.1 }, 0.1)
        .to(hairs, { scaleX: 1, duration: 1.1, ease: 'power3.inOut', stagger: 0.12 }, 0.35)
        .to(rows, { autoAlpha: 1, y: 0, duration: 0.85, ease: 'power3.out', stagger: 0.16 }, 0.55)
        .to(cta, { autoAlpha: 1, y: 0, duration: 0.85, ease: 'power3.out' }, '-=0.35');
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const scrollToContact = () => {
    document.getElementById('contact-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scenarios = [
    {
      index: '01/',
      title: 'Immersive Digital Experience',
      audience: 'Brand che necessitano di un impatto visivo estremo.',
      price: 'Starting at €1,500',
      features: [
        { text: 'Direzione Artistica' },
        { text: 'Animazioni GSAP 60fps' },
        { text: 'Smooth Scroll (Lenis)' },
        { text: 'Ottimizzazione Mobile totale' },
        { text: 'Personalizzazione diversa per Mobile e PC' },
      ],
    },
    {
      index: '02/',
      title: 'Full-Stack Web Application',
      audience: 'Piattaforme che richiedono logiche complesse e gestione dati.',
      price: 'Starting at €3,500',
      features: [
        { text: 'Frontend Immersivo' },
        { python: true, pre: 'Architettura Backend proprietaria scritta in ', post: '' },
        { text: 'Database Architettura custom' },
        { text: 'API Integration sicura' },
        /* DATI CONFIGURATI CON IL NUOVO TOKEN AI */
        { ai: true, pre: 'Possibilità di Inserire ', post: '' },
      ],
    },
  ];

  return (
    <section ref={sectionRef} id="investment-section" className="inv-section">
      <div aria-hidden="true" className="inv-rails">
        <span className="inv-rail inv-rail-l" />
        <span className="inv-rail inv-rail-r" />
      </div>

      <div className="inv-wrap">
        {/* ── HEADER ── */}
        <header className="inv-header">
          <div className="inv-head-meta">
            <span className="inv-mono-label inv-orange">[ INVESTMENT // EARLY STAGE ]</span>
            <span className="inv-mono-label">REV 1.0 / TARIFFARIO</span>
          </div>

          <h2 className="inv-title" aria-label="Non vendo template. Costruisco infrastrutture.">
            <span className="inv-title-row"><span className="inv-title-line">Non vendo template.</span></span>
            <span className="inv-title-row inv-title-row-2"><span className="inv-title-line">Costruisco <em>infrastrutture</em>.</span></span>
          </h2>

          <p className="inv-intro">
            Tariffe da early-adopter per espandere il mio portfolio. La qualità ingegneristica
            di uno studio premium, accessibile oggi a una frazione del costo futuro.
          </p>

          <span className="inv-head-line" aria-hidden="true" />
        </header>

        {/* ── SCENARI ── */}
        <div className="inv-rows">
          {scenarios.map(s => <ScenarioRow key={s.index} {...s} />)}
        </div>

        {/* ── CTA FINALE ── */}
        <div className="inv-ctablock">
          <span className="inv-row-line" aria-hidden="true" />
          <div className="inv-ctablock-grid">
            <div className="inv-ctablock-copy">
              <span className="inv-mono-label inv-green">● PERIMETRO TECNICO</span>
              <p className="inv-ctablock-text">
                Ogni ecosistema è unico. Iniziamo con una Discovery Call gratuita
                per definire il perimetro tecnico.
              </p>
            </div>
            <MagneticCTA label="PRENOTA DISCOVERY" onClick={scrollToContact} />
          </div>
        </div>
      </div>

      <style>{`
        /* ═══ STRUTTURA ═══ */
        .inv-section {
          position: relative;
          background: ${C.bg};
          color: ${C.txt};
          font-family: 'Outfit', sans-serif;
          padding: clamp(5rem, 13svh, 12rem) 0 clamp(4rem, 9svh, 8rem);
          overflow: hidden;
        }
        .inv-rails { position: absolute; inset: 0; pointer-events: none; }
        .inv-rail { position: absolute; top: 0; bottom: 0; width: 1px; background: ${C.hair}; }
        .inv-rail-l { left: clamp(1.25rem, 4vw, 4.5rem); }
        .inv-rail-r { right: clamp(1.25rem, 4vw, 4.5rem); }
        .inv-wrap { position: relative; z-index: 2; padding: 0 clamp(2rem, 6vw, 6.5rem); }

        /* ═══ TIPOGRAFIA DI SERVIZIO ═══ */
        .inv-mono-label {
          font-family: ${MONO};
          font-size: clamp(0.56rem, 0.75vw, 0.68rem);
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${C.mut};
          white-space: nowrap;
        }
        .inv-orange { color: ${C.acc} !important; }
        .inv-green  { color: ${C.green} !important; }

        /* ═══ HEADER ═══ */
        .inv-head-meta {
          display: flex; justify-content: space-between; flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: clamp(2rem, 5svh, 4rem);
        }
        .inv-title {
          margin: 0; padding: 0;
          font-weight: 900;
          font-size: clamp(2.4rem, 7.2vw, 7.5rem);
          line-height: 0.96; letter-spacing: -0.04em;
          color: ${C.txt}; user-select: none;
        }
        .inv-title-row { display: block; overflow: hidden; padding-bottom: 0.08em; }
        .inv-title-row-2 { padding-left: clamp(1rem, 7vw, 8rem); }
        .inv-title-line { display: inline-block; will-change: transform; }
        .inv-title em { font-style: normal; color: ${C.acc}; }
        .inv-intro {
          margin: clamp(1.4rem, 3svh, 2.6rem) 0 clamp(2rem, 4.5svh, 4rem);
          max-width: 52ch;
          margin-left: auto;
          font-size: clamp(0.92rem, 1.15vw, 1.1rem);
          line-height: 1.75; color: ${C.mut};
        }
        .inv-head-line {
          display: block; height: 1px; background: ${C.hair};
          transform-origin: left center;
        }

        /* ═══ RIGHE SCENARIO ═══ */
        .inv-row { position: relative; }
        .inv-row-line {
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: ${C.hair}; transform-origin: left center; display: block;
        }
        .inv-row:first-child .inv-row-line { display: none; }
        .inv-row-grid {
          display: grid;
          grid-template-columns: clamp(4.5rem, 8vw, 8rem) 1.35fr 1fr clamp(11rem, 17vw, 16rem);
          gap: clamp(1.2rem, 2.5vw, 2.8rem);
          align-items: start;
          padding: clamp(2rem, 5svh, 4rem) 0;
          transition: background-color 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @media (hover: hover) and (pointer: fine) {
          .inv-row:hover .inv-row-grid { background-color: ${C.accBg}; }
          .inv-row:hover .inv-row-arrow { transform: translateX(0.5em); color: ${C.acc}; }
          .inv-row:hover .inv-index { color: ${C.acc}; }
        }

        .inv-col-index { display: flex; flex-direction: column; gap: 0.5rem; }
        .inv-index {
          font-family: ${MONO}; font-weight: 600;
          font-size: clamp(1rem, 1.6vw, 1.5rem);
          color: ${C.dim}; transition: color 0.35s ease;
        }
        .inv-index-label {
          font-family: ${MONO}; font-size: clamp(0.5rem, 0.65vw, 0.58rem);
          letter-spacing: 0.2em; color: ${C.dim}; text-transform: uppercase;
        }

        .inv-row-title {
          margin: 0;
          font-weight: 800;
          font-size: clamp(1.5rem, 3.1vw, 3rem);
          line-height: 1.04; letter-spacing: -0.025em;
          color: ${C.txt};
        }
        .inv-row-audience {
          margin: clamp(0.8rem, 1.6svh, 1.3rem) 0 0;
          max-width: 34ch;
          font-size: clamp(0.84rem, 1vw, 0.98rem);
          line-height: 1.65; color: ${C.mut};
        }

        .inv-col-features {
          list-style: none; margin: 0; padding: 0;
          display: flex; flex-direction: column; gap: clamp(0.7rem, 1.4vh, 1rem);
        }
        .inv-feature {
          display: flex; gap: 0.8em; align-items: baseline;
          font-family: ${MONO};
          font-size: clamp(0.64rem, 0.85vw, 0.78rem);
          letter-spacing: 0.08em; text-transform: uppercase;
          color: ${C.mut}; line-height: 1.5;
        }
        .inv-feature-cross { color: ${C.acc}; flex-shrink: 0; }
        
        /* TOKEN PYTHON (Verde Sistema) */
        .inv-python-token {
          color: ${C.green};
          border: 1px solid rgba(74,246,38,0.35);
          padding: 0.1em 0.45em;
          margin-left: 0.1em;
          letter-spacing: 0.14em;
          white-space: nowrap;
        }

        /* TOKEN AI (Arancio Accent) */
        .inv-ai-token {
          color: ${C.acc};
          border: 1px solid rgba(244,162,97,0.35);
          padding: 0.1em 0.45em;
          margin-left: 0.1em;
          letter-spacing: 0.14em;
          white-space: nowrap;
        }

        .inv-col-price {
          display: flex; flex-direction: column; gap: 0.55rem;
          align-items: flex-end; text-align: right;
        }
        .inv-price-label {
          font-family: ${MONO}; font-size: clamp(0.5rem, 0.65vw, 0.58rem);
          letter-spacing: 0.22em; color: ${C.dim}; text-transform: uppercase;
        }
        .inv-price-value {
          font-family: ${MONO}; font-weight: 600;
          font-size: clamp(1.05rem, 1.9vw, 1.8rem);
          letter-spacing: -0.01em; color: ${C.acc};
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .inv-row-arrow {
          font-size: clamp(1.3rem, 2.2vw, 2.1rem);
          color: ${C.dim}; line-height: 1;
          margin-top: clamp(0.6rem, 1.4svh, 1.1rem);
          transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), color 0.35s ease;
        }

        /* ═══ CTA FINALE ═══ */
        .inv-ctablock { position: relative; }
        .inv-ctablock-grid {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: clamp(1.5rem, 4vw, 4rem);
          padding: clamp(2rem, 5svh, 4rem) 0 0;
        }
        .inv-ctablock-copy { display: flex; flex-direction: column; gap: clamp(0.9rem, 2vh, 1.4rem); }
        .inv-ctablock-text {
          margin: 0; max-width: 44ch;
          font-size: clamp(1.05rem, 1.7vw, 1.6rem);
          line-height: 1.45; letter-spacing: -0.01em;
          color: ${C.txt}; font-weight: 500;
        }

        .inv-cta-btn {
          display: inline-flex; align-items: center;
          padding: 0.22rem; border-radius: 5rem;
          border: 1px solid rgba(244,162,97,0.22);
          background: rgba(244,162,97,0.055);
          cursor: pointer; outline: none;
          will-change: transform;
        }
        .inv-cta-inner {
          display: inline-flex; align-items: center; gap: 0.9rem;
          padding: 1.05rem 2.5rem; border-radius: 5rem;
          background: ${C.acc}; color: ${C.bg};
          font-family: ${FONT}; font-size: 0.84rem; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.08em;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.12);
          pointer-events: none;
        }
        .inv-cta-arrow {
          display: flex; align-items: center; justify-content: center;
          width: 2rem; height: 2rem; border-radius: 50%;
          background: rgba(5,3,2,0.18);
          font-size: 1.1rem; line-height: 1; flex-shrink: 0;
        }

        /* ═══ RESPONSIVE ═══ */
        @media (max-width: 980px) {
          .inv-row-grid {
            grid-template-columns: clamp(3.5rem, 9vw, 5rem) 1fr clamp(9rem, 24vw, 12rem);
            grid-template-areas: "idx main price" "idx feat price";
          }
          .inv-col-index { grid-area: idx; }
          .inv-col-main { grid-area: main; }
          .inv-col-features { grid-area: feat; margin-top: clamp(1rem, 2.5svh, 1.6rem); }
          .inv-col-price { grid-area: price; }
        }
        @media (max-width: 768px) {
          .inv-row-grid {
            grid-template-columns: 1fr;
            grid-template-areas: none;
            gap: clamp(1.1rem, 3svh, 1.6rem);
            padding: clamp(1.8rem, 4.5svh, 2.6rem) 0;
          }
          .inv-col-index, .inv-col-main, .inv-col-features, .inv-col-price { grid-area: auto; }
          .inv-col-index { flex-direction: row; align-items: baseline; gap: 0.9rem; }
          .inv-col-features { margin-top: 0; }
          .inv-col-price {
            flex-direction: row; align-items: baseline; justify-content: space-between;
            text-align: left; width: 100%;
            border-top: 1px solid ${C.hair};
            padding-top: clamp(0.9rem, 2svh, 1.3rem);
          }
          .inv-price-label { display: none; }
          .inv-row-arrow { margin-top: 0; }
          .inv-intro { margin-left: 0; }
          .inv-ctablock-grid { grid-template-columns: 1fr; align-items: start; }
          .inv-cta-btn { width: 100%; display: flex; }
          .inv-cta-inner { width: 100%; justify-content: center; }
        }

        /* ═══ REDUCED MOTION ═══ */
        @media (prefers-reduced-motion: reduce) {
          .inv-row-grid, .inv-row-arrow, .inv-index { transition: none; }
        }
      `}</style>
    </section>
  );
}