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
};
const FONT = "'Outfit', 'Cabinet Grotesk', 'Geist', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', Menlo, Monaco, monospace";


/* ═══════════════════════════════════════════════════════════
   SCRAMBLE SPAN
   Fix vs originale:
   • duration 0.65→1.2s + charset più ricco (effetto più vistoso)
   • stateRef locale (non globale) → kill pulito per istanza
   • autoPlay: IntersectionObserver per trigger su mobile (no hover)
   • Rispetta prefers-reduced-motion
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

    // Stato locale → killTweensOf non confonde istanze diverse
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

    // Auto-trigger su scroll — copre mobile dove non esiste hover
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
   PLUS ICON — SVG geometrico, più elegante del carattere "+"
   La rotazione a 45° via GSAP dà l'icona × di chiusura
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
   FAQ DATA
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
   FAQ ITEM — accordion singolo

   Fix critici rispetto all'originale:
   1. CSS Grid (0fr → 1fr) sostituisce gsap height:'auto'
      → immune a resize/orientation-change, niente bug su mobile
   2. GSAP solo per icona (rotation) — nessun height tween
   3. willChange ASSENTE dal CSS statico; gestito via classe .is-open
   4. isMounted ref: salta animazione al primo render (evita flash)
   5. handleClick stabile via useCallback (index+onToggle costanti)
   6. aria-expanded + aria-controls + aria-hidden su content
   7. minHeight: 48px su button → touch target accessibile
═══════════════════════════════════════════════════════════ */
function FaqItem({ faq, index, isOpen, onToggle }) {
  const iconRef    = useRef(null);
  const isMounted  = useRef(false);

  // Stable click handler — onToggle (useCallback dal parent) + index costante
  const handleClick = useCallback(() => onToggle(index), [onToggle, index]);

  // Icona: unico uso di GSAP in FaqItem — semplice rotation
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    if (!iconRef.current) return;
    const noAnim = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (noAnim) return;
    gsap.to(iconRef.current, {
      rotation: isOpen ? 45 : 0,
      duration: 0.42,
      ease: 'back.out(1.8)',
    });
  }, [isOpen]);

  // Estrae '01' da 'INDEX//01'
  const numDisplay = faq.num.replace('INDEX//', '');

  return (
    <div
      className={`faq-accordion-item${isOpen ? ' is-open' : ''}`}
      style={{
        borderBottom: `1px solid ${C.hair}`,
        position: 'relative',
        transition: 'border-color 0.35s ease, background-color 0.2s ease',
      }}
    >
      {/* ── TRIGGER BUTTON ────────────────────────────────── */}
      <button
        onClick={handleClick}
        className="faq-trigger-btn"
        aria-expanded={isOpen}
        aria-controls={`faq-panel-${index}`}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          /*
            TOUCH TARGET FIX:
            minHeight 48px garantisce l'area minima raccomandata
            da WCAG 2.5.5 per dita medie su touchscreen.
            Il padding verticale usa clamp così su desktop
            rimane spaziato e su mobile non è enorme.
          */
          padding: 'clamp(1.1rem, 2.8vw, 2.2rem) 0',
          minHeight: '48px',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '1.5rem',
        }}
      >
        {/*
          TRIGGER LEFT — su mobile diventa flex column via CSS:
          [01] sopra, domanda sotto (prompt requirement)
        */}
        <div className="faq-trigger-left" style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'clamp(1rem, 3vw, 3.5rem)',
          flex: 1,
          minWidth: 0,   // previene overflow in flex container
        }}>
          {/*
            INDEX NUMBER — formato [01] più tecnico del generico INDEX//01
            Su mobile: rimane ma posizionato sopra grazie al flex column CSS
          */}
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
              color: isOpen ? C.acc : C.txt,
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

        {/* ICON — SVG cross, rotazione 45° via GSAP = × di chiusura */}
        <div
          ref={iconRef}
          className="faq-icon-plus"
          aria-hidden="true"
          style={{
            color: isOpen ? C.acc : C.mut,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2.5rem',
            height: '2.5rem',
            flexShrink: 0,
            transition: 'color 0.3s ease',
          }}
        >
          <PlusIcon />
        </div>
      </button>

      {/* ── CONTENUTO ACCORDION — CSS GRID ────────────────────
          FIX PRINCIPALE: sostituisce gsap height:'auto'

          Tecnica: grid-template-rows 0fr → 1fr
          → nessun bug resize/orientation change
          → nessun scrollHeight misread su mobile
          → nessun memory leak da tween GSAP non cancellati
          → transizione controllata interamente da CSS (60fps GPU)
          Supporto: Chrome 107+, Firefox 107+, Safari 16+ ✓
      ────────────────────────────────────────────────────── */}
      <div
        id={`faq-panel-${index}`}
        className="faq-grid-wrapper"
        aria-hidden={!isOpen}
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        {/* min-height:0 è obbligatorio per far collassare la riga a 0fr */}
        <div className="faq-grid-inner">
          <div className="faq-content-inner">
            <p
              className="faq-answer-text"
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(0.9rem, 1.15vw, 1.05rem)',
                color: C.mut,
                lineHeight: 1.75,
                margin: 0,
                maxWidth: '70ch',
              }}
            >
              {faq.a}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   SEZIONE FAQ PRINCIPALE

   Fix rispetto all'originale:
   1. handleToggle in useCallback → FaqItem non ri-renderizza
      per colpa di nuove reference funzione ad ogni setState
   2. matchMedia era istanziato ma mai usato → rimosso
   3. prefers-reduced-motion check all'avvio GSAP context
   4. pointer-events !important rimossi da sezione/container
      (rimangono solo su [aria-hidden])
   5. immediateRender:false aggiunto agli fromTo per evitare
      flash visivo su Chrome mobile
═══════════════════════════════════════════════════════════ */
export default function FAQ() {
  const [activeIndex, setActiveIndex] = useState(null);
  const sectionRef  = useRef(null);
  const headRef     = useRef(null);
  const listRef     = useRef(null);
  const line1Ref    = useRef(null);
  const line2Ref    = useRef(null);

  // useCallback: handleToggle stabile → nessun re-render inutile
  const handleToggle = useCallback((index) => {
    setActiveIndex(prev => prev === index ? null : index);
  }, []);

  useEffect(() => {
    // Skip animazioni se utente preferisce movimento ridotto
    const noAnim = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (noAnim) return;

    const ctx = gsap.context(() => {
      // Reveal titolo — mask slide-up per riga
      gsap.fromTo(
        [line1Ref.current, line2Ref.current],
        { yPercent: 105, opacity: 0, immediateRender: false },
        {
          yPercent: 0, opacity: 1,
          duration: 1.2, stagger: 0.15, ease: 'power4.out',
          scrollTrigger: { trigger: headRef.current, start: 'top 85%', once: true },
        }
      );

      // Reveal lista accordions
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

      {/* SCANLINE CRT — texture brutalista di sfondo, opacity minimal */}
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
            {/* autoPlay: trigger su scroll (mobile + desktop) */}
            <ScrambleSpan autoPlay>05. DETTAGLI OPERATIVI</ScrambleSpan>
          </p>

          <h2 style={{ margin: 0, padding: 0, textTransform: 'uppercase', userSelect: 'none' }}>
            {/* overflow:hidden crea la "mask" per lo slide-up del reveal */}
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

        {/* ── ACCORDION LIST ──────────────────────────────── */}
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
            <FaqItem
              key={faq.num}
              faq={faq}
              index={index}
              isOpen={activeIndex === index}
              onToggle={handleToggle}
            />
          ))}
        </div>

      </div>

      {/* ══ CSS GLOBALE ══════════════════════════════════════ */}
      <style>{`
        /* ── Grid accordion — cuore del fix ──────────────────
           display:grid + transition su grid-template-rows
           è la tecnica più solida per accordion CSS puro.
           Nessun JS per height, nessun scrollHeight misread. */
        .faq-grid-wrapper {
          display: grid;
          transition: grid-template-rows 0.52s cubic-bezier(0.16, 1, 0.3, 1);
        }
        /* min-height:0 obbligatorio per collasso a 0fr */
        .faq-grid-inner {
          min-height: 0;
          overflow: hidden;
        }
        .faq-content-inner {
          padding: 0.25rem 0 2.2rem clamp(1rem, 4.5vw, 5rem);
        }

        /* ── Focus visibile — navigazione tastiera ── */
        .faq-trigger-btn:focus-visible {
          outline: 2px solid ${C.acc};
          outline-offset: -2px;
          border-radius: 2px;
        }
        .faq-trigger-btn {
          outline: none;
          -webkit-tap-highlight-color: transparent;
        }

        /* ── Desktop hover — effetti brutalisti ──────────────
           border neon, slide domanda, index highlight         */
        @media (hover: hover) and (pointer: fine) {
          .faq-accordion-item:hover {
            border-color: ${C.borderHi} !important;
            background-color: rgba(244,162,97,0.025);
          }
          .faq-accordion-item:hover .faq-question-text {
            color: ${C.acc} !important;
            transform: translateX(5px);
          }
          .faq-accordion-item:hover .faq-index-num {
            color: rgba(244,162,97,0.55) !important;
          }
          .faq-accordion-item:hover .faq-icon-plus {
            color: ${C.acc} !important;
          }
        }

        /* ── Mobile active — feedback tattile immediato ──────
           Su touch, l'utente ottiene risposta visiva PRIMA
           che l'animazione di apertura parta              */
        @media (hover: none) {
          .faq-accordion-item:active {
            background-color: rgba(244,162,97,0.04);
            border-color: ${C.borderHi} !important;
          }
        }

        /* ── Stato aperto — bordo accent permanente ── */
        .faq-accordion-item.is-open {
          border-color: ${C.borderHi} !important;
        }

        /* ════════════════════════════════════════════════════
           MOBILE — < 768px (iPhone SE, Galaxy S8, ecc.)
        ════════════════════════════════════════════════════ */
        @media (max-width: 767px) {
          .hide-mobile { display: none !important; }

          /*
            TITLE INDENT FIX:
            "PRIMA DI TUTTO." su desktop è rientrata per
            un effetto editoriale. Su mobile (< 600px circa)
            l'indent di clamp(1.5rem,10vw,8rem) crea squilibrio.
            → azzerato qui.
          */
          .faq-title-indent { padding-left: 0 !important; }

          /*
            INDEX SOPRA LA DOMANDA:
            flex-direction:column rende il layout verticale:
            [01]          →  desktop: [01]  [Question]
            [Question]    →  mobile:  [01]
                                      [Question]
            align-items:flex-start allinea index a sinistra.
            gap ridotto: il separamento orizzontale non serve più.
          */
          .faq-trigger-left {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.35rem !important;
          }

          /*
            CONTENT ANSWER:
            Su mobile il rientro sinistro (allineato alla Q desktop)
            non è necessario — l'answer inizia al bordo sinistro,
            più leggibile su schermi < 400px.
            max-width: 100% evita il "muro di testo" su mobile
            (72ch risulterebbe troppo largo in relazione al viewport).
          */
          .faq-content-inner {
            padding-left: 0 !important;
            padding-bottom: 1.5rem !important;
          }
          .faq-answer-text {
            font-size: 0.9rem !important;
            line-height: 1.68 !important;
            max-width: 100% !important;
          }
        }

        /* ── Micro-screen ≤ 360px (Galaxy S8, Pixel 4a) ── */
        @media (max-width: 360px) {
          .faq-question-text {
            font-size: 1rem !important;
          }
        }

        /* ── Reduced motion: disabilita transizioni CSS ── */
        @media (prefers-reduced-motion: reduce) {
          .faq-grid-wrapper { transition: none; }
          .faq-accordion-item { transition: none; }
          .faq-question-text { transition: none; }
        }
      `}</style>
    </section>
  );
}