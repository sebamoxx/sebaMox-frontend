import { useEffect, useRef, useState, memo, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════ */
const C = {
  bg:       '#050302',
  bgDeep:   '#020100',
  acc:      '#F4A261',
  gold:     '#E9C46A',
  txt:      '#F0E6D3',
  mut:      'rgba(240,230,211,0.4)',
  dim:      'rgba(240,230,211,0.12)',
  hair:     'rgba(240,230,211,0.065)',
  borderHi: 'rgba(244,162,97,0.35)',
  panel:    '#0A0604',
};
const FONT = "'Outfit', 'Cabinet Grotesk', 'Geist', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', Menlo, Monaco, monospace";


/* ═══════════════════════════════════════════════════════════
   SCRAMBLE SPAN — invariato
═══════════════════════════════════════════════════════════ */
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789◈⬡◎§#@%&+=<>↗◆▪□◇▽△▸';

const ScrambleSpan = memo(({ children, style, autoPlay = false }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const text   = String(children);
    const noAnim = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (noAnim) return;

    const state = { p: 0 };

    const run = () => {
      state.p = 0;
      gsap.killTweensOf(state);
      gsap.to(state, {
        p: 1, duration: 1.2, ease: 'power3.out',
        onUpdate() {
          const n = Math.floor(state.p * text.length);
          el.textContent = text.split('').map((ch, i) =>
            i < n ? ch : ch === ' ' ? ' ' : CHARSET[Math.floor(Math.random() * CHARSET.length)]
          ).join('');
        },
        onComplete() { el.textContent = text; },
      });
    };

    el.addEventListener('mouseenter', run);

    let obs;
    if (autoPlay) {
      obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) { setTimeout(run, 280); obs.disconnect(); }
      }, { threshold: 0.7 });
      obs.observe(el);
    }

    return () => {
      el.removeEventListener('mouseenter', run);
      obs?.disconnect();
      gsap.killTweensOf(state);
    };
  }, [children, autoPlay]);

  return <span ref={ref} style={style}>{children}</span>;
});


/* ═══════════════════════════════════════════════════════════
   CROSSHAIR — invariato
═══════════════════════════════════════════════════════════ */
const Crosshair = ({ style }) => (
  <div style={{ position: 'absolute', width: 18, height: 18, pointerEvents: 'none', zIndex: 1, ...style }}>
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <line x1="9" y1="0"  x2="9"  y2="18" stroke={C.dim} strokeWidth="0.8" />
      <line x1="0" y1="9"  x2="18" y2="9"  stroke={C.dim} strokeWidth="0.8" />
    </svg>
  </div>
);


/* ═══════════════════════════════════════════════════════════
   PLUS ICON — SVG geometrico (trigger: indica "apri")
═══════════════════════════════════════════════════════════ */
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="9" y1="2"  x2="9"  y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="9"  x2="16" y2="9"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   CLOSE ICON — × geometrica per l'overlay HUD
═══════════════════════════════════════════════════════════ */
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="3" y1="3"  x2="13" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="13" y1="3" x2="3"  y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}


/* ═══════════════════════════════════════════════════════════
   FAQ DATA — preservato 1:1
═══════════════════════════════════════════════════════════ */
const FAQS = [
  {
    num: 'INDEX//01',
    q: 'Quanto costa un sito web custom?',
    a: "I miei progetti su misura partono da 1.500€. Non uso template pre-fatti: ogni riga di codice viene scritta da zero per modellarsi sul tuo brand, garantendo una velocità di caricamento istantanea e un design unico al mondo.",
  },
  {
    num: 'INDEX//02',
    q: 'Quanto tempo serve per andare online?',
    a: "Un progetto standard richiede di norma dalle 2 alle 4 settimane, dalla prima call conoscitiva al deploy finale su server. Lavorando a sprint pianificati, vedrai la piattaforma crescere su un link privato.",
  },
  {
    num: 'INDEX//03',
    q: 'Devo fornire io i testi e le immagini?',
    a: "Se possiedi già asset visivi e copy di livello li integreremo nel layout. In caso contrario, posso strutturare la logica e la produzione di contenuti ad alto impatto per massimizzare il tasso di conversione del sito.",
  },
  {
    num: 'INDEX//04',
    q: 'Cosa succede dopo la messa online?',
    a: "Ogni release include 30 giorni di supporto tecnico e manutenzione totale post-lancio. Successivamente possiamo stabilire piani di monitoraggio dedicati, oppure potrai gestire le pagine in totale autonomia.",
  },
  {
    num: 'INDEX//05',
    q: 'Garantisci le performance dell\'architettura?',
    a: "Assolutamente sì. Sviluppando l'ecosistema digitale con tecnologie moderne e un solido backend, garantisco un punteggio Google Lighthouse stabile superiore a 90, ottimizzando posizionamento organico (SEO) ed esperienza utente.",
  },
];


/* ═══════════════════════════════════════════════════════════
   FAQ TRIGGER — card statica nella lista

   ZERO LAYOUT SHIFT:
   • Nessuna espansione inline. Altezza FISSA e immutabile.
   • Al click chiama onOpen(faq, index) → apre l'overlay HUD.
   • Niente CSS Grid 0fr→1fr, niente ResizeObserver, niente
     misurazioni di altezza, niente ScrollTrigger.refresh.
═══════════════════════════════════════════════════════════ */
function FaqTrigger({ faq, index, isActive, onOpen }) {
  const numDisplay = faq.num.replace('INDEX//', '');

  const handleClick = useCallback((e) => {
    // RULE: niente scroll-into-view nativo sul tap del button
    try { e.currentTarget.blur(); } catch { /* Safari datati */ }
    onOpen(faq, index);
  }, [faq, index, onOpen]);

  return (
    <div
      className={`faq-trigger-item${isActive ? ' is-active' : ''}`}
      style={{
        borderBottom: `1px solid ${C.hair}`,
        position: 'relative',
        transition: 'border-color 0.35s ease, background-color 0.2s ease',
      }}
    >
      <button
        onClick={handleClick}
        className="faq-trigger-btn"
        aria-haspopup="dialog"
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          padding: 'clamp(1.1rem, 2.8vw, 2.2rem) 0',
          minHeight: '48px',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '1.5rem',
        }}
      >
        <div className="faq-trigger-left" style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'clamp(1rem, 3vw, 3.5rem)',
          flex: 1,
          minWidth: 0,
        }}>
          <span
            className="faq-index-num"
            aria-hidden="true"
            style={{
              fontFamily: MONO,
              fontSize: '0.66rem',
              color: C.dim,
              letterSpacing: '0.06em',
              flexShrink: 0,
              transition: 'color 0.3s ease',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            [{numDisplay}]
          </span>

          <h3
            className="faq-question-text"
            style={{
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 'clamp(1.05rem, 1.8vw, 1.55rem)',
              color: C.txt,
              margin: 0,
              letterSpacing: '-0.025em',
              lineHeight: 1.3,
              transition: 'color 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
              minWidth: 0,
            }}
          >
            {faq.q}
          </h3>
        </div>

        <div
          className="faq-icon-plus"
          aria-hidden="true"
          style={{
            color: C.mut,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2.5rem',
            height: '2.5rem',
            flexShrink: 0,
            transition: 'color 0.3s ease, transform 0.45s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <PlusIcon />
        </div>
      </button>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   OVERLAY HUD — Bottom Sheet (mobile) / Modal (desktop)

   • position:fixed; inset:0; z-index:9999
   • background scuro + backdrop-filter:blur (glassmorphism)
   • Mobile  (<768px): bottom sheet ancorato in basso, slide-up
   • Desktop (>=768px): modale centrato, max-width 600px
   • data-state="open"/"closed" → transizioni CSS fluide
   • Chiusura: bottone X, click sull'overlay, tasto Escape
═══════════════════════════════════════════════════════════ */
function FaqOverlay({ entry, isOpen, onClose }) {
  const closeBtnRef = useRef(null);

  // Focus iniziale sul bottone di chiusura (accessibilità HUD)
  useEffect(() => {
    if (isOpen && closeBtnRef.current) {
      closeBtnRef.current.focus({ preventScroll: true });
    }
  }, [isOpen]);

  if (!entry) return null;
  const { faq, index } = entry;
  const numDisplay = faq.num.replace('INDEX//', '');
  const state = isOpen ? 'open' : 'closed';

  // Chiude solo se il click è sull'overlay (sfondo), non sul pannello
  const handleOverlayMouseDown = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="faq-overlay"
      data-state={state}
      onMouseDown={handleOverlayMouseDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="faq-hud-title"
    >
      <div className="faq-panel" data-state={state} role="document">

        {/* ── DRAG HANDLE — solo mobile (visivo, stile bottom sheet) ── */}
        <div className="faq-panel-handle" aria-hidden="true" />

        {/* ── HEADER HUD — "Terminale Dati" ── */}
        <div className="faq-panel-head">
          <div className="faq-panel-meta">
            <span className="faq-panel-index">[{numDisplay}]</span>
            <span className="faq-panel-tag">// QUERY RISOLTA</span>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            className="faq-panel-close"
            onClick={onClose}
            aria-label="Chiudi"
          >
            <span className="faq-panel-close-label">CLOSE</span>
            <span className="faq-panel-close-icon"><CloseIcon /></span>
          </button>
        </div>

        {/* ── BODY — scrolla autonomamente se troppo lungo ── */}
        <div className="faq-panel-body">
          <h3 id="faq-hud-title" className="faq-panel-question">
            {faq.q}
          </h3>

          <div className="faq-panel-divider" aria-hidden="true" />

          <p className="faq-panel-answer">
            {faq.a}
          </p>
        </div>

        {/* ── FOOTER HUD — riga tecnica decorativa ── */}
        <div className="faq-panel-foot" aria-hidden="true">
          <span>ESC / TAP OUT — TO CLOSE</span>
          <span>{String(index + 1).padStart(2, '0')} / {String(FAQS.length).padStart(2, '0')}</span>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   SEZIONE FAQ PRINCIPALE — pattern Overlay HUD

   GESTIONE STATO:
   • entry  → { faq, index } attivo (resta montato durante l'uscita)
   • isOpen → pilota data-state per le transizioni CSS
   Flusso apertura: setEntry → (doppio rAF) setIsOpen(true)
   Flusso chiusura: setIsOpen(false) → (timeout = durata tween) setEntry(null)

   SCROLL FREEZE (senza toccare Lenis / App.jsx):
   • overflow:hidden sul <body> finché l'overlay è montato
   • compensazione scrollbar → ZERO layout shift dietro l'overlay
═══════════════════════════════════════════════════════════ */
export default function FAQ() {
  const [entry, setEntry]   = useState(null);   // { faq, index } | null
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef(null);

  const sectionRef  = useRef(null);
  const headRef     = useRef(null);
  const listRef     = useRef(null);
  const line1Ref    = useRef(null);
  const line2Ref    = useRef(null);

  /* ── APRI ─────────────────────────────────────────────── */
  const openFaq = useCallback((faq, index) => {
    clearTimeout(closeTimer.current);
    setEntry({ faq, index });
    // doppio rAF: monta in stato "closed" → frame dopo passa a "open"
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsOpen(true));
    });
  }, []);

  /* ── CHIUDI ───────────────────────────────────────────── */
  const closeFaq = useCallback(() => {
    setIsOpen(false);
    clearTimeout(closeTimer.current);
    // smonta a transizione conclusa (520ms > durata animazione pannello)
    closeTimer.current = setTimeout(() => setEntry(null), 520);
  }, []);

  // Pulizia timer all'unmount
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  /* ── SCROLL FREEZE NATIVO ──────────────────────────────────
     Niente Lenis qui: congelo il <body>. La compensazione della
     scrollbar evita che la pagina dietro "salti" di lato. */
  useEffect(() => {
    if (!entry) return;
    const body = document.body;
    const sbw  = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadRight = body.style.paddingRight;

    body.style.overflow = 'hidden';
    if (sbw > 0) body.style.paddingRight = `${sbw}px`;

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadRight;
    };
  }, [entry]);

  /* ── ESCAPE → chiudi ──────────────────────────────────── */
  useEffect(() => {
    if (!entry) return;
    const onKey = (e) => { if (e.key === 'Escape') closeFaq(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entry, closeFaq]);

  /* ── REVEAL ANIMATIONS (titolo + lista trigger) ──────────
     Layout ora STATICO: nessun ScrollTrigger.refresh al toggle. */
  useEffect(() => {
    const noAnim = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (noAnim) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        [line1Ref.current, line2Ref.current],
        { yPercent: 105, opacity: 0, immediateRender: false },
        {
          yPercent: 0, opacity: 1,
          duration: 1.2, stagger: 0.15, ease: 'power4.out',
          scrollTrigger: { trigger: headRef.current, start: 'top 85%', once: true },
        }
      );

      if (listRef.current?.children?.length) {
        gsap.fromTo(
          [...listRef.current.children],
          { opacity: 0, y: 40, immediateRender: false },
          {
            opacity: 1, y: 0,
            duration: 1, stagger: 0.09, ease: 'power3.out',
            scrollTrigger: { trigger: listRef.current, start: 'top 88%', once: true },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id = "faq"
      ref={sectionRef}
      className="awwwards-faq-section"
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: C.bg,
        borderTop: `1px solid ${C.hair}`,
        overflow: 'hidden',
        padding: 'clamp(4rem, 10svh, 10rem) 0',
        zIndex: 5,
      }}
    >

      {/* SCANLINE CRT */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent, transparent 3px,
          rgba(240,230,211,0.018) 3px, rgba(240,230,211,0.018) 4px
        )`,
      }} />

      {/* BINARI VERTICALI */}
      <div className="faq-bg-rails" aria-hidden="true">
        <div style={{ position: 'absolute', left:  'clamp(1.5rem, 4vw, 4.5rem)', top: 0, bottom: 0, width: 1, background: C.hair, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 'clamp(1.5rem, 4vw, 4.5rem)', top: 0, bottom: 0, width: 1, background: C.hair, pointerEvents: 'none' }} />
      </div>

      {/* MIRINI ANGOLARI */}
      <Crosshair style={{ top: 8, left: 8 }} />
      <Crosshair style={{ top: 8, right: 8 }} />
      <Crosshair style={{ bottom: 8, left: 8 }} />
      <Crosshair style={{ bottom: 8, right: 8 }} />

      {/* WATERMARK */}
      <div className="hide-mobile" aria-hidden="true" style={{
        position: 'absolute',
        top: 'clamp(2rem, 4svh, 4rem)', right: 'clamp(2.5rem, 6vw, 6rem)',
        zIndex: 1, pointerEvents: 'none',
        fontFamily: MONO, fontWeight: 700,
        fontSize: 'clamp(5rem, 10vw, 12rem)',
        color: 'transparent', WebkitTextStroke: `1px ${C.dim}`,
        lineHeight: 1, userSelect: 'none',
      }}>
        05
      </div>

      {/* ══ CONTENUTO ══ */}
      <div style={{
        position: 'relative', zIndex: 10,
        maxWidth: '1440px', margin: '0 auto',
        padding: '0 clamp(1.5rem, 5vw, 5rem)',
      }}>

        {/* ── HEADER ──────────────────────────────────────── */}
        <div
          ref={headRef}
          style={{ marginBottom: 'clamp(3rem, 7svh, 6rem)', position: 'relative', zIndex: 10 }}
        >
          <p style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            fontFamily: MONO, fontSize: '0.75rem', color: C.acc,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            margin: '0 0 1.8rem',
          }}>
            <span style={{ width: '2.5rem', height: 1, background: C.acc, opacity: 0.6, display: 'inline-block', flexShrink: 0 }} />
            <ScrambleSpan autoPlay>05. DETTAGLI OPERATIVI</ScrambleSpan>
          </p>

          <h2 style={{ margin: 0, padding: 0, textTransform: 'uppercase', userSelect: 'none' }}>
            <div style={{ overflow: 'hidden', minHeight: '1.05em' }}>
              <div ref={line1Ref}>
                <span style={{
                  fontFamily: FONT, fontWeight: 900,
                  fontSize: 'clamp(2.5rem, 5.5vw, 7rem)',
                  color: 'transparent',
                  WebkitTextStroke: `1.5px rgba(240,230,211,0.45)`,
                  display: 'block', lineHeight: 1, letterSpacing: '-0.03em',
                }}>
                  CHIAREZZA
                </span>
              </div>
            </div>

            <div style={{ overflow: 'hidden', minHeight: '1.05em' }}
              className="faq-title-indent">
              <div ref={line2Ref}>
                <span style={{
                  fontFamily: FONT, fontWeight: 900,
                  fontSize: 'clamp(2.5rem, 5.5vw, 7rem)',
                  color: C.txt,
                  display: 'block', lineHeight: 1, letterSpacing: '-0.03em',
                }}>
                  PRIMA DI TUTTO.
                </span>
              </div>
            </div>
          </h2>
        </div>

        {/* ── LISTA TRIGGER (altezza statica) ─────────────── */}
        <div
          ref={listRef}
          style={{
            display: 'flex', flexDirection: 'column',
            maxWidth: '1000px',
            margin: '0 auto',
            position: 'relative',
            zIndex: 100,
          }}
        >
          {FAQS.map((faq, index) => (
            <FaqTrigger
              key={faq.num}
              faq={faq}
              index={index}
              isActive={entry?.index === index}
              onOpen={openFaq}
            />
          ))}
        </div>

      </div>

      {/* ══ OVERLAY HUD ══════════════════════════════════════ */}
      <FaqOverlay entry={entry} isOpen={isOpen} onClose={closeFaq} />

      {/* ══ CSS GLOBALE ══════════════════════════════════════ */}
      <style>{`
        /* ── Focus visibile — navigazione tastiera ── */
        .faq-trigger-btn:focus-visible {
          outline: 2px solid ${C.acc};
          outline-offset: -2px;
          border-radius: 2px;
        }
        .faq-trigger-btn {
          outline: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        /* ── Desktop hover — effetti brutalisti ── */
        @media (hover: hover) and (pointer: fine) {
          .faq-trigger-item:hover {
            border-color: ${C.borderHi} !important;
            background-color: rgba(244,162,97,0.025);
          }
          .faq-trigger-item:hover .faq-question-text {
            color: ${C.acc} !important;
            transform: translateX(5px);
          }
          .faq-trigger-item:hover .faq-index-num {
            color: rgba(244,162,97,0.55) !important;
          }
          .faq-trigger-item:hover .faq-icon-plus {
            color: ${C.acc} !important;
            transform: rotate(90deg);
          }
        }

        /* ── Mobile active — feedback tattile immediato ── */
        @media (hover: none) {
          .faq-trigger-item:active {
            background-color: rgba(244,162,97,0.04);
            border-color: ${C.borderHi} !important;
          }
        }

        /* ── Stato attivo (overlay aperto su questa domanda) ── */
        .faq-trigger-item.is-active {
          border-color: ${C.borderHi} !important;
        }
        .faq-trigger-item.is-active .faq-question-text { color: ${C.acc}; }
        .faq-trigger-item.is-active .faq-icon-plus     { color: ${C.acc}; transform: rotate(45deg); }

        /* ════════════════════════════════════════════════════
           OVERLAY HUD — backdrop glassmorphism
           Flex container: bottom-anchor su mobile, center su desktop.
        ════════════════════════════════════════════════════ */
        .faq-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: flex-end;        /* mobile: bottom sheet */
          justify-content: center;
          background: rgba(0,0,0,0);
          -webkit-backdrop-filter: blur(0px);
          backdrop-filter: blur(0px);
          transition: background 0.45s ease, backdrop-filter 0.45s ease, -webkit-backdrop-filter 0.45s ease;
          will-change: background, backdrop-filter;
        }
        .faq-overlay[data-state="open"] {
          background: rgba(0,0,0,0.6);
          -webkit-backdrop-filter: blur(10px);
          backdrop-filter: blur(10px);
        }

        /* ════════════════════════════════════════════════════
           PANNELLO — Bottom Sheet (mobile, base mobile-first)
        ════════════════════════════════════════════════════ */
        .faq-panel {
          position: relative;
          width: 100%;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          background: ${C.panel};
          border-top: 1px solid ${C.borderHi};
          border-left: 1px solid ${C.hair};
          border-right: 1px solid ${C.hair};
          border-radius: 20px 20px 0 0;
          box-shadow: 0 -24px 60px rgba(0,0,0,0.6);
          padding: 0.6rem clamp(1.4rem, 5vw, 2rem) calc(1.6rem + env(safe-area-inset-bottom, 0px));
          transform: translateY(101%);
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform;
          overflow: hidden;
        }
        .faq-panel[data-state="open"] { transform: translateY(0); }

        /* texture scanline interna — coerenza brutalista */
        .faq-panel::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: inherit;
          background-image: repeating-linear-gradient(
            0deg, transparent, transparent 3px,
            rgba(240,230,211,0.015) 3px, rgba(240,230,211,0.015) 4px
          );
        }

        /* drag handle — solo mobile */
        .faq-panel-handle {
          width: 42px;
          height: 4px;
          border-radius: 99px;
          background: ${C.dim};
          margin: 0.3rem auto 0.9rem;
          flex-shrink: 0;
        }

        /* ── HEADER HUD ── */
        .faq-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding-bottom: 1rem;
          margin-bottom: 1.2rem;
          border-bottom: 1px solid ${C.hair};
          flex-shrink: 0;
        }
        .faq-panel-meta {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          min-width: 0;
        }
        .faq-panel-index {
          font-family: ${MONO};
          font-size: 0.72rem;
          color: ${C.acc};
          letter-spacing: 0.08em;
        }
        .faq-panel-tag {
          font-family: ${MONO};
          font-size: 0.66rem;
          color: ${C.mut};
          letter-spacing: 0.14em;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── CLOSE BUTTON ── */
        .faq-panel-close {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          background: rgba(244,162,97,0.06);
          border: 1px solid ${C.borderHi};
          color: ${C.acc};
          font-family: ${MONO};
          font-size: 0.66rem;
          letter-spacing: 0.12em;
          padding: 0.5rem 0.7rem;
          border-radius: 6px;
          cursor: pointer;
          flex-shrink: 0;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease;
        }
        .faq-panel-close:hover {
          background: ${C.acc};
          color: ${C.bgDeep};
        }
        .faq-panel-close:focus-visible {
          outline: 2px solid ${C.acc};
          outline-offset: 2px;
        }
        .faq-panel-close-icon { display: inline-flex; }

        /* ── BODY — scroll autonomo, pagina dietro ferma ── */
        .faq-panel-body {
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;   /* niente scroll-chaining sulla pagina */
          flex: 1 1 auto;
          min-height: 0;
          padding-right: 4px;
        }
        .faq-panel-question {
          font-family: ${FONT};
          font-weight: 700;
          font-size: clamp(1.3rem, 5vw, 1.7rem);
          color: ${C.txt};
          letter-spacing: -0.02em;
          line-height: 1.25;
          margin: 0;
        }
        .faq-panel-divider {
          width: 2.5rem;
          height: 2px;
          background: ${C.acc};
          opacity: 0.7;
          margin: 1.1rem 0 1.3rem;
        }
        .faq-panel-answer {
          font-family: ${FONT};
          font-size: clamp(0.95rem, 3.6vw, 1.05rem);
          color: ${C.mut};
          line-height: 1.75;
          margin: 0;
        }

        /* ── FOOTER HUD ── */
        .faq-panel-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-top: 1.4rem;
          padding-top: 0.9rem;
          border-top: 1px solid ${C.hair};
          font-family: ${MONO};
          font-size: 0.6rem;
          letter-spacing: 0.12em;
          color: ${C.dim};
          flex-shrink: 0;
        }

        /* ── Scrollbar custom nel pannello ── */
        .faq-panel-body::-webkit-scrollbar { width: 4px; }
        .faq-panel-body::-webkit-scrollbar-thumb {
          background: ${C.borderHi};
          border-radius: 99px;
        }
        .faq-panel-body { scrollbar-width: thin; scrollbar-color: ${C.borderHi} transparent; }

        /* ════════════════════════════════════════════════════
           DESKTOP >= 768px — MODALE CENTRATO
        ════════════════════════════════════════════════════ */
        @media (min-width: 768px) {
          .faq-overlay { align-items: center; padding: 2rem; }

          .faq-panel {
            width: 100%;
            max-width: 600px;
            max-height: 80vh;
            border: 1px solid ${C.borderHi};
            border-radius: 12px;
            padding: 1.6rem 2rem 1.8rem;
            box-shadow: 0 30px 80px rgba(0,0,0,0.7);
            /* entrata: leggero rise + scale (stile card high-tech) */
            transform: translateY(28px) scale(0.97);
            opacity: 0;
            transition: transform 0.46s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.32s ease;
          }
          .faq-panel[data-state="open"] {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          .faq-panel-handle { display: none; }
        }

        /* ════════════════════════════════════════════════════
           MOBILE — < 768px (layout lista)
        ════════════════════════════════════════════════════ */
        @media (max-width: 767px) {
          .hide-mobile { display: none !important; }
          .faq-title-indent { padding-left: 0 !important; }
          .faq-trigger-left {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.35rem !important;
          }
        }

        @media (max-width: 360px) {
          .faq-question-text { font-size: 1rem !important; }
        }

        /* ── Reduced motion: niente transizioni ── */
        @media (prefers-reduced-motion: reduce) {
          .faq-overlay,
          .faq-panel,
          .faq-question-text,
          .faq-icon-plus,
          .faq-trigger-item { transition: none !important; }
          .faq-panel { transform: none !important; opacity: 1 !important; }
        }
      `}</style>
    </section>
  );
}
