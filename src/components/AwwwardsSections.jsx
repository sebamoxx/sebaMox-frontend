import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import FAQ from './FAQ';
import Manifesto from './Manifesto';
import Footer from './Footer';
import LabSection  from './labSection';
import WorkSection from './WorkSection';
import TechStack from './TechStack.jsx'
import KineticCanvas from './KineticCanvas';
import InvestmentSection from './InvestmentSection.jsx';
import StressTestSection from './StressTestSection.jsx'
import RobotSpline from './RobotSpline';
import { Link } from 'react-router-dom';


/* ScrollTrigger registrato in App.jsx */

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — SISTEMA VANTABLACK
   Sfondo: #050302 | Accent: #F4A261 | Gold: #E9C46A
   Linee strutturali: rgba(240,230,211,0.065)
═══════════════════════════════════════════════════════════════ */
const C = {
  bg:        '#050302',
  bgDeep:    '#030201',
  bgCard:    'rgba(10, 7, 4, 0.7)',
  bgHover:   'rgba(20, 14, 7, 0.92)',
  accent:    '#F4A261',
  gold:      '#E9C46A',
  text:      '#F0E6D3',
  muted:     'rgba(240,230,211,0.46)',
  faint:     'rgba(240,230,211,0.055)',
  rail:      'rgba(240,230,211,0.065)',
  border:    'rgba(244,162,97,0.12)',
  borderHi:  'rgba(244,162,97,0.50)',
};
const FONT = "'Outfit', 'Geist', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', Menlo, monospace";

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE — LINEE VERTICALI INDUSTRIALI A BINARI
═══════════════════════════════════════════════════════════════ */
function RailLines() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0 clamp(1rem, 4vw, 4.5rem)',
      }}
    >
      <div style={{ width: '1px', background: C.rail, height: '100%' }} />
      <div style={{ width: '1px', background: C.rail, height: '100%', opacity: 0.45 }} />
      <div style={{ width: '1px', background: C.rail, height: '100%', opacity: 0.45 }} />
      <div style={{ width: '1px', background: C.rail, height: '100%' }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE — MIRINO SVG (CROSSHAIR)
═══════════════════════════════════════════════════════════════ */
function Crosshair({ color = C.accent, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <line x1="10" y1="0"  x2="10" y2="7"  stroke={color} strokeWidth="0.9" />
      <line x1="10" y1="13" x2="10" y2="20" stroke={color} strokeWidth="0.9" />
      <line x1="0"  y1="10" x2="7"  y2="10" stroke={color} strokeWidth="0.9" />
      <line x1="13" y1="10" x2="20" y2="10" stroke={color} strokeWidth="0.9" />
      <circle cx="10" cy="10" r="2" stroke={color} strokeWidth="0.9" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOOKS DI ANIMAZIONE — GSAP CONTEXT-SAFE
═══════════════════════════════════════════════════════════════ */

/** Reveal con clip-path masking dall'alto */
function useTextReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, yPercent: 8, immediateRender: false },
        {
          opacity: 1,
          yPercent: 0,
          duration: 1.2,
          ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 90%' },
        }
      );
    });
    return () => ctx.revert();
  }, []);
  return ref;
}

/** Reveal staggerato per gruppi di figli */
function useReveal(stagger = 0.12) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.children.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.children,
        { opacity: 0, y: 32, scale: 0.98, immediateRender: false },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1.1,
          stagger,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 90%' },
        }
      );
    });
    return () => ctx.revert();
  }, [stagger]);
  return ref;
}

/** Fisica magnetica sul cursore — desktop only */
function useMagnetic(power = 0.45) {
  const ref = useRef(null);
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(hover: hover) and (pointer: fine)', () => {
      const el = ref.current;
      if (!el) return;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.65, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.65, ease: 'power3.out' });
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width  / 2) * power);
        yTo((e.clientY - r.top  - r.height / 2) * power);
      };
      const onLeave = () =>
        gsap.to(el, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.38)' });
      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', onLeave);
      return () => {
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('mouseleave', onLeave);
      };
    });
    return () => mm.revert();
  }, [power]);
  return ref;
}

/* ═══════════════════════════════════════════════════════════════
   SEZIONE 1 — SERVICES BENTO
═══════════════════════════════════════════════════════════════ */
const SERVICES = [
  {
    id: 'web', icon: '◈', large: true, accent: C.accent,
    label: 'Siti Web Custom',
    sub: 'Architettura front-end su misura: zero template, zero compromessi. Velocità, estetica e tasso di conversione ingegnerizzati come un unico sistema coerente.',
    tags: ['React', 'Next.js', 'GSAP', 'WebGL'],
  },
  { id: 'ecom', icon: '⬡', accent: C.gold, label: 'E-commerce', sub: 'Checkout friction-free, UX studiata per ridurre l\'abbandono e scalare le revenue senza alzare il budget ads.' },
  { id: 'land', icon: '◎', accent: C.accent, label: 'Landing Page', sub: 'Dal brief al live in 48h. Above the fold ottimizzato per catturare attenzione nei primi 3 secondi.' },
  { id: 'app',  icon: '⬢', accent: C.gold, label: 'Web App & SaaS', sub: 'Dashboard e portali clienti con architettura solida. Interfacce che gli utenti scelgono di usare ogni giorno.' },
  { id: 'brand',icon: '◐', accent: C.accent, label: 'Brand Identity', sub: 'Sistema visivo: logotipo, palette, tipografia. Progettato per il digitale prima, scalabile su ogni superficie.' },
  { id: 'seo',  icon: '◉', accent: C.gold, label: 'Tech SEO & CWV', sub: 'Core Web Vitals > 90, struttura semantica impeccabile. Ranking organico costruito per durare anni.' },
];

function ServiceCard({ service }) {
  const cardRef = useRef(null);
  const isLarge = service.large;

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current || window.innerWidth < 768) return;
    const r = cardRef.current.getBoundingClientRect();
    cardRef.current.style.setProperty('--mx', `${e.clientX - r.left}px`);
    cardRef.current.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, []);

  const corners = [
    { top: '0.8rem',    left: '0.8rem'  },
    { top: '0.8rem',    right: '0.8rem' },
    { bottom: '0.8rem', left: '0.8rem'  },
    { bottom: '0.8rem', right: '0.8rem' },
  ];

  return (
    <div
      id="sezione-servizi"
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`bento-card${isLarge ? ' bento-large' : ''}`}
      style={{
        position: 'relative',
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: '0.2rem',
        padding: isLarge ? 'clamp(1.5rem, 4vw, 3.5rem)' : 'clamp(1.2rem, 2.5vw, 2.2rem)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(8px)',
        transition: 'border-color 0.4s ease, transform 0.4s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {corners.map((pos, i) => (
        <span key={i} style={{ position: 'absolute', ...pos, opacity: 0.3, pointerEvents: 'none', zIndex: 2 }}>
          <Crosshair color={service.accent} size={14} />
        </span>
      ))}

      <div className="bento-glow" style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `radial-gradient(550px circle at var(--mx, -999px) var(--my, -999px), rgba(244,162,97,0.07), transparent 45%)`,
        opacity: 0, transition: 'opacity 0.35s ease',
      }} />

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span className="bento-icon" style={{
          fontSize: isLarge ? 'clamp(2.5rem, 4vw, 3.5rem)' : 'clamp(1.8rem, 2.5vw, 2.2rem)',
          color: service.accent, lineHeight: 1,
          marginBottom: isLarge ? '2.5rem' : '1.5rem',
          display: 'inline-block',
          transition: 'transform 0.4s ease',
        }}>
          {service.icon}
        </span>

        <h3 style={{
          fontFamily: FONT, fontWeight: 700,
          fontSize: isLarge ? 'clamp(1.5rem, 3vw, 2.5rem)' : 'clamp(1.05rem, 1.8vw, 1.45rem)',
          color: C.text, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '0.9rem',
        }}>
          {service.label}
        </h3>

        <p style={{
          fontFamily: FONT,
          fontSize: isLarge ? 'clamp(0.9rem, 1.2vw, 1.05rem)' : '0.875rem',
          color: C.muted, lineHeight: 1.7, flex: 1, margin: 0,
        }}>
          {service.sub}
        </p>

        {isLarge && service.tags && (
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
            {service.tags.map(t => (
              <span key={t} style={{
                fontFamily: MONO, fontSize: '0.58rem', fontWeight: 600, color: service.accent,
                padding: '0.35rem 0.8rem', borderRadius: '0.1rem',
                border: `1px solid ${C.border}`,
                background: 'rgba(244,162,97,0.04)',
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ServicesSection() {
  const titleRef = useTextReveal();
  const gridRef  = useReveal(0.08);

  return (
    <>
      <style>{`
        /* ════════════════════════════════════════════════════
           SERVICES GRID — 3 BREAKPOINTS
           Mobile:  1 col, aspect-ratio (fix spazio nero)
           Tablet:  2 col, web card full-width
           Desktop: 2fr|1fr|1fr, web card colonna verticale
        ════════════════════════════════════════════════════ */

        .services-grid {
          display: grid;
          gap: 0.6rem;
          grid-template-columns: 1fr;
          grid-auto-rows: auto;
        }

        /* ── MOBILE: aspect-ratio per ogni card → zero spazio vuoto ── */
        @media (max-width: 767px) {
          .services-grid > * {
            aspect-ratio: 4 / 3;
          }
          /* La card large è più alta delle altre */
          .services-grid > :nth-child(1) {
            aspect-ratio: 3 / 2;
          }
          .services-glow { display: none; }
        }

        /* ── TABLET: 2 colonne, web full-width ── */
        @media (min-width: 768px) and (max-width: 1023px) {
          .services-grid {
            grid-template-columns: repeat(2, 1fr);
            grid-auto-rows: auto;
          }
          /* Web card prende tutta la riga */
          .services-grid > :nth-child(1) {
            grid-column: span 2;
            min-height: 300px;
          }
          /* Le altre 5 si distribuiscono da sola */
          .services-grid > :not(:nth-child(1)) {
            min-height: 220px;
          }
        }

        /* ── DESKTOP: bento asimmetrico brutale ─────────────────────
           Layout:
           col →    [  2fr – WEB  ] [ 1fr ] [ 1fr ]
           row 1:   [ web          ] [ecom ] [land ]  260px
           row 2:   [ web          ] [app  ] [brand]  260px
           row 3:   [ web          ] [seo        ]   180px

           Web: colonna sinistra dominante 50% × 100% altezza.
           Seo: span 2 cols in fondo come fascia conclusiva.
        ──────────────────────────────────────────────────────────── */
        @media (min-width: 1024px) {
          .services-grid {
            grid-template-columns: 2fr 1fr 1fr;
            grid-template-rows: 260px 260px 180px;
            grid-auto-rows: unset;
            grid-template-areas:
              "web  ecom  land"
              "web  app   brand"
              "web  seo   seo";
          }

          /* Named area per ogni card tramite nth-child */
          .services-grid > :nth-child(1) { grid-area: web;   }
          .services-grid > :nth-child(2) { grid-area: ecom;  }
          .services-grid > :nth-child(3) { grid-area: land;  }
          .services-grid > :nth-child(4) { grid-area: app;   }
          .services-grid > :nth-child(5) { grid-area: brand; }
          .services-grid > :nth-child(6) { grid-area: seo;   }
        }

        /* ── Card hover: glow + lift ── */
        .bento-card:hover {
          border-color: rgba(244,162,97,0.45) !important;
          transform: translateY(-2px);
        }
        .bento-card:hover .bento-glow {
          opacity: 1 !important;
        }
        .bento-card:hover .bento-icon {
          transform: scale(1.08);
        }

        /* Seo card in desktop: layout orizzontale
           perché è larga 2/4 della griglia ma bassa 180px */
        @media (min-width: 1024px) {
          .services-grid > :nth-child(6) {
            flex-direction: row;
            align-items: center;
            gap: 2rem;
          }
          .services-grid > :nth-child(6) .bento-icon {
            margin-bottom: 0;
            flex-shrink: 0;
          }
        }

        /* PERF: blur decorativo pesante → rimosso su mobile */
        @media (max-width: 767px) {
          .services-glow { display: none; }
        }
      `}</style>

      <section style={{
        background: C.bg,
        padding: 'clamp(2.5rem, 6vw, 12rem) clamp(1.2rem, 5vw, 5rem)',
        position: 'relative',
        borderTop: `1px solid ${C.faint}`,
        overflow: 'hidden',
      }}>

        <div className="services-glow" style={{
          position: 'absolute', top: '-10%', left: '-5%',
          width: '50%', height: '50%',
          background: `radial-gradient(circle, rgba(244,162,97,0.035) 0%, transparent 70%)`,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

          <div style={{ marginBottom: 'clamp(2rem, 6vw, 8rem)' }}>
            <p style={{
              fontFamily: MONO, fontSize: '0.68rem', color: C.accent,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.8rem',
            }}>
              <Crosshair color={C.accent} size={12} />
              [ 01 / COMPETENZE ]
            </p>
            <div style={{ overflow: 'hidden', paddingBottom: '0.1em' }}>
              <h2 ref={titleRef} style={{
                fontFamily: FONT, fontWeight: 900,
                fontSize: 'clamp(2rem, 7vw, 7.5rem)',
                letterSpacing: '-0.04em', lineHeight: 0.92,
                color: C.text, margin: 0,
              }}>
                Cosa costruisco<br />
                <em style={{
                  fontStyle: 'normal',
                  background: `linear-gradient(135deg, ${C.accent} 0%, ${C.gold} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'inline-block',
                }}>
                  per te
                </em>
              </h2>
            </div>
          </div>

          <div ref={gridRef} className="services-grid">
            {SERVICES.map(s => <ServiceCard key={s.id} service={s} />)}
          </div>

        </div>
      </section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SEZIONE 2 — SELECTED WORK — REFACTOR BRUTALISTA (V2)
═══════════════════════════════════════════════════════════════ 

const PROJECTS = [
  {
    id: '1', index: 'SYS_001', name: 'Volta', category: 'E-commerce / Fashion', role: 'Design + Dev', year: '2025',
    image: 'https://picsum.photos/seed/volta-ecommerce-fashion/1400/900',
    wide: true,
  },
  {
    id: '2', index: 'SYS_002', name: 'Meridiem', category: 'SaaS / Productivity', role: 'Full-Stack', year: '2024',
    image: 'https://picsum.photos/seed/meridiem-saas-dashboard/1400/900',
    wide: false,
  },
  {
    id: '3', index: 'SYS_003', name: 'Bosco', category: 'Landing / Lifestyle', role: 'Design', year: '2025',
    image: 'https://picsum.photos/seed/bosco-nature-landing/1400/900',
    wide: false,
  },
  {
    id: '4', index: 'SYS_004', name: 'Aurore', category: 'Brand Identity', role: 'Brand + Dev', year: '2024',
    image: 'https://picsum.photos/seed/aurore-luxury-brand/1400/900',
    wide: true,
  },
];

function TechnicalProgressBar({ progress, activeIndex }) {
  const pct = Math.floor(progress * 100).toString().padStart(3, '0');
  return (
    <div className="tech-progress-container">
      <div className="tech-readout">
        <span>[ BITSTREAM_CORE_ACTIVE ]</span>
        <span className="tech-pct">INDEX_TRK: {activeIndex + 1}/{PROJECTS.length} // VAL_{pct}%</span>
      </div>
      <div className="tech-rail">
        <div className="tech-bar" style={{ width: `${progress * 100}%` }} />
        {PROJECTS.map((_, i) => (
          <div 
            key={i} 
            className={`tech-node ${i === activeIndex ? 'active' : ''}`}
            style={{ left: `${(i / (PROJECTS.length - 1)) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

const scrambleText = (element, targetText, duration = 1.2) => {
  if (!element) return;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_@#$%-+=*[]';
  let frame = 0;
  const totalFrames = Math.floor(duration * 60);
  const originalLength = targetText.length;

  const interval = setInterval(() => {
    let currentText = '';
    for (let i = 0; i < originalLength; i++) {
      if (i < (frame / totalFrames) * originalLength) {
        currentText += targetText[i];
      } else if (targetText[i] === ' ') {
        currentText += ' ';
      } else {
        currentText += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    element.innerText = currentText;
    frame++;
    if (frame >= totalFrames) {
      element.innerText = targetText;
      clearInterval(interval);
    }
  }, 1000 / 60);
  return interval;
};

export function WorkSection() {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const headerRef = useRef(null);
  const cursorRef = useRef(null);
  
  const [globalProgress, setGlobalProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkMedia = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkMedia();

    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        checkMedia();
        ScrollTrigger.refresh();
      }, 250);
    };
    window.addEventListener('resize', handleResize);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const moveCursor = (e) => {
      if (!cursorRef.current || window.innerWidth < 768) return;
      const bounds = sectionRef.current.getBoundingClientRect();
      if (bounds.top <= window.innerHeight && bounds.bottom >= 0) {
        gsap.to(cursorRef.current, {
          x: e.clientX,
          y: e.clientY,
          duration: 0.1,
          opacity: 1,
          ease: 'power2.out'
        });
      } else {
        gsap.set(cursorRef.current, { opacity: 0 });
      }
    };
    window.addEventListener('mousemove', moveCursor);

    const mm = gsap.matchMedia();

    if (!prefersReducedMotion) {
      mm.add('(min-width: 768px)', () => {
        const track = trackRef.current;
        if (!track) return;

        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top 75%',
          onEnter: () => {
            const h2Span = headerRef.current?.querySelector('.scramble-target');
            if (h2Span) scrambleText(h2Span, 'Scelti', 1.5);
            document.querySelectorAll('.card-title-scramble').forEach(title => {
              scrambleText(title, title.getAttribute('data-text'), 1.2);
            });
          },
          once: true
        });

        // Funzione per calcolare l'esatto progresso (da 0 a 1) in cui ogni card è perfettamente centrata.
        const getSnapPoints = () => {
          const cards = gsap.utils.toArray('.work-card', track);
          const trackScrollWidth = track.scrollWidth - window.innerWidth;
          
          return cards.map(card => {
            const cardCenter = card.offsetLeft + (card.offsetWidth / 2);
            const requiredX = cardCenter - (window.innerWidth / 2);
            return gsap.utils.clamp(0, 1, requiredX / trackScrollWidth);
          });
        };

        const horizontalTween = gsap.to(track, {
          x: () => -(track.scrollWidth - window.innerWidth),
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            pin: true,
            scrub: 1,
            start: 'top top',
            end: () => `+=${track.scrollWidth}`, // Dà un po' più di respiro allo scroll
            invalidateOnRefresh: true,
            snap: {
              // Usa la nostra funzione personalizzata per agganciarsi al centro calcolato
              snapTo: (value) => gsap.utils.snap(getSnapPoints(), value),
              duration: { min: 0.3, max: 0.6 },
              delay: 0.05,
              ease: 'power3.inOut'
            },
            onUpdate: (self) => {
              setGlobalProgress(self.progress);
              
              // Calcola qual è la card centrata attualmente per aggiornare i numeri
              const points = getSnapPoints();
              let closestIndex = 0;
              let minDiff = Infinity;
              points.forEach((p, i) => {
                const diff = Math.abs(p - self.progress);
                if (diff < minDiff) { minDiff = diff; closestIndex = i; }
              });
              setActiveIndex(closestIndex);

              const velocity = self.getVelocity();
              const skewValue = gsap.utils.clamp(-7, 7, velocity / 350);
              gsap.to('.wc-parallax', { skewX: skewValue, duration: 0.3, ease: 'power2.out' });
            }
          }
        });

        gsap.utils.toArray('.wc-parallax').forEach((img) => {
          gsap.fromTo(img, 
            { xPercent: 20 },
            { xPercent: -20, ease: 'none',
              scrollTrigger: {
                trigger: img, containerAnimation: horizontalTween,
                start: 'left right', end: 'right left', scrub: true,
                onToggle: (self) => img.style.willChange = self.isActive ? 'transform, filter' : 'auto'
              }
            }
          );
        });

        gsap.utils.toArray('.wc-img').forEach((img) => {
          gsap.fromTo(img,
            // IMMAGINI RISOLTE: luminosità molto più alta (0.75 anzichè 0.3)
            { filter: 'grayscale(100%) brightness(0.75) contrast(1.2) saturate(0)' },
            { filter: 'grayscale(0%) brightness(1.05) contrast(1) saturate(1.2)',
              ease: 'power1.inOut',
              scrollTrigger: { trigger: img, containerAnimation: horizontalTween, start: 'left 75%', end: 'left 30%', scrub: true }
            }
          );
        });
      });

       
      mm.add('(max-width: 767px)', () => {
        gsap.utils.toArray('.work-card').forEach((card) => {
          gsap.fromTo(card,
            { opacity: 0, y: 60 },
            { opacity: 1, y: 0, duration: 0.8, ease: 'power4.out',
              scrollTrigger: { trigger: card, start: 'top 85%', toggleActions: 'play none none none' }
            }
          );
        });
      });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', moveCursor);
      mm.revert();
    };
  }, []);

  return (
    <section ref={sectionRef} className="work-section" style={{ background: C.bgDeep }}>
      
      <style>{`
        .work-section {
          position: relative;
          overflow: hidden;
          width: 100%;
          background-image: 
            linear-gradient(rgba(0, 255, 102, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 102, 0.04) 1px, transparent 1px);
          background-size: 50px 50px;
          background-position: center top;
        }

        .crt-scanline {
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.3) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.04));
          background-size: 100% 4px, 6px 100%;
          z-index: 2;
          pointer-events: none;
          opacity: 0.4;
        }

        .brutalist-cursor {
          position: fixed;
          width: 70px;
          height: 70px;
          border: 2px dashed ${C.accent};
          background: rgba(10, 10, 12, 0.85);
          color: ${C.accent};
          font-family: ${MONO};
          font-size: 0.65rem;
          font-weight: bold;
          letter-spacing: 0.15em;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 9999;
          transform: translate(-50%, -50%);
          opacity: 0;
          box-shadow: 0 0 15px rgba(0, 255, 102, 0.2);
        }

        .work-track {
          display: flex;
          align-items: center;
          height: 75vh;
           Padding eliminati. Il centraggio è ora gestito algebricamente sui margin delle card 
        }

        .work-card {
          flex-shrink: 0;
          position: relative;
          overflow: hidden;
          background: #1a1a24; Colore di riserva più chiaro, se l'immagine è in caricamento non vedi solo nero 
          border-top: 3px solid ${C.rail};
          border-left: 3px solid ${C.rail};
          border-bottom: 1px solid ${C.rail};
          border-right: 1px solid ${C.rail};
          transition: border-color 0.1s ease, box-shadow 0.1s ease;
        }

        @media (min-width: 768px) {
          .work-card:hover {
            border-top-color: ${C.accent};
            border-left-color: ${C.accent};
            border-bottom-color: ${C.accent};
            border-right-color: ${C.accent};
            box-shadow: 0 0 25px rgba(0, 255, 102, 0.35);
          }
          .work-card:hover .wc-img { filter: grayscale(0%) brightness(1.1) contrast(1) saturate(1.5) !important; }
          .work-card:hover .wc-glitch-overlay { animation: glitch-scan-anim 0.4s steps(3) infinite; opacity: 0.15; }
          .work-card:hover .big-index-decor { color: ${C.accent}; opacity: 0.08; transform: translate(-45%, -50%) scale(1.05); }
        }

        @keyframes glitch-scan-anim {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }

        .tech-progress-container { width: 100%; font-family: ${MONO}; }
        .tech-readout { display: flex; justify-content: space-between; font-size: 0.7rem; color: ${C.muted}; margin-bottom: 8px; letter-spacing: 0.1em; }
        .tech-pct { color: ${C.accent}; font-weight: bold; }
        .tech-rail { position: relative; width: 100%; height: 4px; background: rgba(26,26,36,0.8); border: 1px solid rgba(255,255,255,0.05); }
        .tech-bar { height: 100%; background: ${C.accent}; box-shadow: 0 0 10px ${C.accent}; transition: width 0.1s linear; }
        .tech-node { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: #111116; border: 1px solid ${C.muted}; transition: all 0.3s ease; }
        .tech-node.active { border-color: ${C.accent}; background: ${C.accent}; box-shadow: 0 0 8px ${C.accent}; }

        @media (max-width: 767px) {
          .brutalist-cursor { display: none !important; }
          .work-track { display: block !important; height: auto !important; padding: 0 20px !important; transform: none !important; }
          
          verride totale per evitare i margin custom di centraggio su mobile 
          .work-card { width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; margin-bottom: 40px !important; height: auto !important; aspect-ratio: 4 / 3 !important; align-self: auto !important; }
          .wc-parallax { transform: none !important; width: 100% !important; height: 100% !important; inset: 0 !important; }
          .wc-img { filter: grayscale(0%) brightness(0.9) contrast(1.1) !important; }
          .tech-progress-container { display: none !important; }
          .mobile-counter-fallback { display: block !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; transform: none !important; filter: none !important; }
          .wc-parallax { transform: none !important; }
          .work-track { display: block !important; height: auto !important; }
          .work-card { width: 100% !important; margin-left: 0 !important; margin-bottom: 30px !important; }
        }
      `}</style>

      <div ref={cursorRef} className="brutalist-cursor">DRAG_X</div>

      <div ref={headerRef} className="work-header" style={{
        padding: 'clamp(3rem, 6vw, 6rem) clamp(1.5rem, 5vw, 5rem) clamp(2rem, 3.5vw, 3.5rem)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px dashed rgba(0, 255, 102, 0.15)'
      }}>
        <div>
          <p style={{ fontFamily: MONO, fontSize: '0.7rem', color: C.accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <Crosshair color={C.accent} size={12} />
            [ SYSTEM_LOG // 02_SELECTED_WORKS ]
          </p>
          <h2 style={{ fontFamily: FONT, fontWeight: 900, fontSize: 'clamp(2.2rem, 6.5vw, 7rem)', color: C.text, letterSpacing: '-0.04em', margin: 0, lineHeight: 0.85, textTransform: 'uppercase' }}>
            Lavori <span className="scramble-target" style={{ fontStyle: 'normal', color: C.bgDeep, background: C.accent, padding: '0 10px', display: 'inline-block' }}>Scelti</span>
          </h2>
        </div>
        
        <div style={{ textAlign: isDesktop ? 'right' : 'left' }}>
          <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: C.muted, letterSpacing: '0.12em', margin: '0 0 0.35rem', textTransform: 'uppercase' }}>TOTAL_PAYLOAD: {PROJECTS.length} BLOCKS</p>
          <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: C.accent, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }}>STATUS: Pinned horizontal matrix</p>
        </div>
      </div>

      <div ref={trackRef} className="work-track">
        {PROJECTS.map((p, i) => {
          // CENTRAGGIO ALGEBRICO: definiamo la larghezza esatta e usiamo calc()
          // In questo modo la prima card è spinta esattamente al 50% dello schermo (il centro visivo)
          const cardW = p.wide ? 'clamp(420px, 48vw, 820px)' : 'clamp(300px, 34vw, 560px)';
          
          return (
            <div key={p.id} className="work-card" style={{
              '--card-w': cardW,
              width: 'var(--card-w)',
              height: i % 2 === 0 ? '75%' : '62%', 
              alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end',
              // Primo e ultimo elemento hanno margin estremi per consentire al track di centrarli perfettamente all'inizio e alla fine
              marginLeft: i === 0 ? 'calc(50vw - (var(--card-w) / 2))' : 0,
              marginRight: i === PROJECTS.length - 1 ? 'calc(50vw - (var(--card-w) / 2))' : 'clamp(2rem, 6vw, 6rem)',
            }}>
              
              <div className="big-index-decor" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontFamily: FONT, fontSize: '16vw', fontWeight: 900, color: C.rail, opacity: 0.04, zIndex: 0, pointerEvents: 'none', transition: 'all 0.3s steps(4)', userSelect: 'none' }}>
                {p.index.split('_')[1]}
              </div>

              <img className="wc-img wc-parallax" src={p.image} alt={p.name} style={{ display: 'block', position: 'absolute', inset: isDesktop ? '-20% -15%' : '0', width: isDesktop ? '130%' : '100%', height: isDesktop ? '130%' : '100%', objectFit: 'cover' }} />
              
              <div className="crt-scanline" />
              <div className="wc-glitch-overlay" style={{ position: 'absolute', inset: 0, background: `linear-gradient(transparent, ${C.accent}, transparent)`, opacity: 0, zIndex: 3, pointerEvents: 'none' }} />

              
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,12,0.8) 0%, rgba(10,10,12,0.2) 40%, transparent 100%)', zIndex: 3, pointerEvents: 'none' }} />

              <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 4 }}><Crosshair color={C.accent} size={10} /></div>
              <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 4 }}><Crosshair color={C.accent} size={10} /></div>
              <div style={{ position: 'absolute', bottom: '12px', left: '12px', zIndex: 4 }}><Crosshair color={C.muted} size={10} /></div>
              <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 4 }}><Crosshair color={C.muted} size={10} /></div>

              <div style={{ position: 'absolute', top: '20px', left: '28px', zIndex: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: C.accent, backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 6px', border: `1px solid ${C.rail}` }}>{p.index}</span>
              </div>
              <div style={{ position: 'absolute', top: '20px', right: '28px', zIndex: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: C.text, opacity: 0.7 }}>//{p.year}</span>
              </div>

              <div style={{ position: 'absolute', bottom: '25px', left: '25px', right: '25px', zIndex: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', background: C.accent }} />
                  <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', wordBreak: 'break-word' }}>{p.category} — {p.role}</span>
                </div>
                <h3 className="card-title-scramble" data-text={p.name} style={{ fontFamily: FONT, fontWeight: 900, fontSize: 'clamp(1.5rem, 4vw, 3rem)', color: C.text, margin: 0, letterSpacing: '-0.03em', lineHeight: 0.9, textTransform: 'uppercase' }}>
                  {p.name}
                </h3>
              </div>
              
              <div className="mobile-counter-fallback" style={{ display: 'none', position: 'absolute', bottom: '25px', right: '25px', zIndex: 4, fontFamily: MONO, fontSize: '0.7rem', color: C.muted, border: `1px solid ${C.muted}`, padding: '2px 6px' }}>
                {(i + 1).toString().padStart(2, '0')} / {PROJECTS.length.toString().padStart(2, '0')}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ margin: '0 clamp(1.5rem, 5vw, 5rem) clamp(3rem, 6vw, 6rem)', position: 'relative', zIndex: 10 }}>
        <TechnicalProgressBar progress={globalProgress} activeIndex={activeIndex} />
      </div>
    </section>
  );
}

*/

/* ═══════════════════════════════════════════════════════════════
   SEZIONE 3 — PROCESS — ASYMMETRIC STICKY TRACK
   ─ Sinistra sticky con numeri giganti parallax
   ─ Destra: card scrollabili con numero ghost attivo
   ─ Indicatore step progress bar laterale
═══════════════════════════════════════════════════════════════ */
const STEPS = [
  {
    num: '01', duration: '20 min', title: 'Discovery Call',
    sub: 'Scavo nel tuo brand, nei tuoi obiettivi e nel mercato reale. Nessun template mentale, nessun pregiudizio. Capire prima di proporre: è l\'unico modo per costruire qualcosa che duri.',
    kpi: 'ZERO STRESS — ZERO IMPEGNO',
  },
  {
    num: '02', duration: '48–72h', title: 'Proposta & System Design',
    sub: 'Roadmap dettagliata, costi fissi senza sorprese e una direzione visiva precisa. Approvi la visione prima che inizi un singolo pixel. Niente scope creep, niente ambiguità.',
    kpi: 'FIXED-PRICE — NIENTE SCOPE CREEP',
  },
  {
    num: '03', duration: '1–3 settimane', title: 'Build in Pubblico',
    sub: 'Il sito prende vita su un link privato aggiornato in tempo reale. Feedback asincrono, iterazioni veloci, comunicazione radicalmente trasparente. Non aspetti — partecipi.',
    kpi: 'PREVIEW LIVE — FEEDBACK CONTINUO',
  },
  {
    num: '04', duration: '1 giorno', title: 'Launch & Ownership',
    sub: 'Deploy impeccabile, trasferimento completo di asset, codice e accessi. 30 giorni di supporto post-lancio inclusi. Il sito è tuo: codice pulito, nessuna dipendenza da me.',
    kpi: '30GG SUPPORTO — CODICE TUO',
  },
];

/*
  ProcessSection — drop-in replacement per AwwwardsSections.jsx
  ─────────────────────────────────────────────────────────────
  Bug corretti rispetto alla versione precedente:

  1. `overflow: hidden` sulla <section> → ROTTO: uccide position:sticky.
     Fix: `overflow: clip` — clippa senza creare nuovo stacking context
     e senza rompere sticky.

  2. `display: grid` + `position: sticky` + z-index multipli
     → comportamento inconsistente tra browser.
     Fix: tornato a `display: flex; align-items: flex-start`.
     Il left panel sticky funziona in modo nativo e affidabile con flex.

  3. Ghost numbers in layer absolute SEPARATO dal left panel
     → venivano clippati dalla section overflow:hidden e non si
     sincronizzavano visivamente con il testo sticky.
     Fix: numeri ghost DENTRO .process-left come absolute children,
     così scrollano/stickano insieme al testo.

  4. `process-right` aveva z-index:5 + background:C.bg → copriva
     il pannello sinistro in alcuni browser webkit.
     Fix: rimosso z-index dal right panel, background solo dove serve.
*/

function ProcessSection() {
  const sectionRef = useRef(null);
  const stepsRef   = useRef(null);
  const numRefs    = useRef([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add('(min-width: 900px)', () => {
      const ctx = gsap.context(() => {
        numRefs.current.forEach((el, i) => {
          if (!el) return;
          gsap.fromTo(el,
            { yPercent: 20 + i * 6, immediateRender: false },
            {
              yPercent: -(20 + i * 6),
              ease: 'none',
              scrollTrigger: {
                trigger: stepsRef.current,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1.4 + i * 0.2,
              },
            }
          );
        });

        const steps = gsap.utils.toArray('.process-step', sectionRef.current);
        steps.forEach((step, i) => {
          ScrollTrigger.create({
            trigger: step,
            start: 'top center',
            end: 'bottom center',
            onEnter:     () => setActive(i),
            onEnterBack: () => setActive(i),
          });
        });
      }, sectionRef);
      return () => ctx.revert();
    });

    mm.add('(max-width: 899px)', () => {
      const ctx = gsap.context(() => {
        gsap.utils.toArray('.process-step', sectionRef.current).forEach((step, i) => {
          gsap.fromTo(step,
            { opacity: 0, y: 30, immediateRender: false },
            { opacity: 1, y: 0, duration: 1, ease: 'power3.out',
              scrollTrigger: { trigger: step, start: 'top 86%' } }
          );

          // ← AGGIUNTO: progress dots seguono lo scroll anche su mobile
          ScrollTrigger.create({
            trigger: step,
            start: 'top 65%',
            end:   'bottom 35%',
            onEnter:     () => setActive(i),
            onEnterBack: () => setActive(i),
          });
        });
      }, sectionRef);
      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return (
    <section
      id = "sezione-process"
      ref={sectionRef}
      style={{
        background: C.bg,
        borderTop: `1px solid ${C.faint}`,
        position: 'relative',
        /* Niente overflow:hidden/clip sulla section —
           romperebbe position:sticky sul pannello sinistro */
      }}
    >
      <div
        className="process-wrapper"
        style={{
          display: 'flex',
          alignItems: 'flex-start',   /* FONDAMENTALE per sticky in flex */
          maxWidth: '1440px',
          margin: '0 auto',
          width: '100%',
          position: 'relative',
        }}
      >

        {/* ══ SINISTRA — sticky CSS, numeri ghost interni ══ */}
        <div
          className="process-left"
          style={{
            flexShrink: 0,
            width: '40%',
            position: 'sticky',
            top: 0,
            height: '100svh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            boxSizing: 'border-box',
            padding: 'clamp(5rem,10vw,10rem) clamp(1.5rem,3vw,3rem) clamp(5rem,10vw,10rem) clamp(1.5rem,5vw,5rem)',
            /* overflow:hidden sul left panel (non sulla section):
               clippa i numeri giganti whiteSpace:nowrap che sbordano
               SENZA rompere lo sticky, perché è sul figlio non sul parent */
            overflow: 'hidden',
          }}
        >
          {/* Numeri ghost — absolute DENTRO il left panel
              → stickano con il testo, parallax via GSAP */}
          <div
            aria-hidden="true"
            className="process-ghost"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '0.5rem',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            {STEPS.map((s, i) => (
              <div
                key={`ghost-${s.num}`}
                ref={el => { numRefs.current[i] = el; }}
                style={{
                  fontFamily: FONT,
                  fontWeight: 900,
                  fontSize: 'clamp(5rem, 11vw, 13rem)',
                  color: i === active ? C.accent : C.text,
                  opacity: i === active ? 0.18 : 0.05,
                  letterSpacing: '-0.06em',
                  lineHeight: 0.85,
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.5s ease, opacity 0.5s ease',
                  willChange: 'transform',
                  textAlign: 'right',
                  paddingRight: '1.5rem',
                  flexShrink: 0,
                }}
              >
                {s.num}
              </div>
            ))}
          </div>

          {/* Testo sticky — z:1 sopra i ghost */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{
              fontFamily: MONO, fontSize: '0.68rem', color: C.accent,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              marginBottom: '2rem',
              display: 'flex', alignItems: 'center', gap: '0.8rem',
            }}>
              <Crosshair color={C.accent} size={12} />
              [ 03 / IL METODO ]
            </p>

            <h2 style={{
              fontFamily: FONT, fontWeight: 900,
              fontSize: 'clamp(1.8rem, 4.5vw, 5.5rem)',
              letterSpacing: '-0.04em', lineHeight: 0.92,
              color: C.text, margin: '0 0 2.5rem',
            }}>
              Come<br />
              <em style={{ fontStyle: 'normal', color: C.gold }}>costruiamo</em><br />
              insieme
            </h2>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  width:  i === active ? '2.8rem' : '0.45rem',
                  height: '2px', borderRadius: '2px',
                  background: i === active ? C.accent : C.faint,
                  transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)',
                }} />
              ))}
              <span style={{
                fontFamily: MONO, fontSize: '0.6rem', color: C.muted,
                letterSpacing: '0.1em', marginLeft: '0.4rem',
              }}>
                {String(active + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* ══ DESTRA — card scrollabili ══ */}
        <div
          ref={stepsRef}
          className="process-right"
          style={{
            flex: 1,
            minWidth: 0,       /* previene overflow-x in flex */
            padding: 'clamp(5rem,10vw,10rem) clamp(2rem,4vw,4rem) clamp(10rem,18vw,18rem) clamp(1.5rem,3vw,3rem)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxSizing: 'border-box',
          }}
        >
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className="process-step"
              style={{
                position: 'relative',
                padding: 'clamp(2rem,4vw,4rem)',
                /*
                  FIX VISIBILITÀ — bug precedente:
                  rgba(10,7,4,0.7) su sfondo #050302 = colore risultante
                  rgb(9,6,3) = indistinguibile dal nero.

                  Nuovi valori con contrasto percepibile:
                  - Inattivo: #120c06 — marrone scurissimo, diverso da #050302
                  - Attivo:   #23180c — marrone caldo, chiaramente leggibile
                */
                background: i === active
                  ? 'rgba(244,162,97,0.07)'   /* ambra tenue — visibile su qualsiasi monitor */
                  : 'rgba(255,255,255,0.04)',  /* vetro bianco — chiaramente diverso dal bg */
                border: `1px solid ${i === active
                  ? 'rgba(244,162,97,0.50)'
                  : 'rgba(255,255,255,0.09)'}`,
                borderRadius: '0.2rem',
                transition: 'background 0.4s ease, border-color 0.4s ease',
                overflow: 'hidden',
              }}
            >
              {/* Numero ghost interno alla card */}
              <div style={{
                position: 'absolute', top: '-0.5rem', right: '1rem',
                fontFamily: FONT, fontWeight: 900,
                fontSize: 'clamp(4.5rem,9vw,10rem)',
                color: i === active ? C.accent : C.text,
                opacity: i === active ? 0.1 : 0.03,
                letterSpacing: '-0.06em', lineHeight: 1,
                userSelect: 'none', pointerEvents: 'none',
                transition: 'opacity 0.4s ease, color 0.4s ease',
              }}>
                {step.num}
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Duration badge */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                  padding: '0.3rem 0.75rem',
                  background: i === active ? 'rgba(244,162,97,0.1)' : 'rgba(244,162,97,0.05)',
                  border: `1px solid ${i === active ? 'rgba(244,162,97,0.3)' : 'rgba(244,162,97,0.08)'}`,
                  borderRadius: '0.1rem',
                  fontFamily: MONO, fontSize: '0.58rem', color: C.accent,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  marginBottom: '2rem',
                  transition: 'all 0.4s ease',
                }}>
                  <Crosshair color={C.accent} size={10} />
                  {step.duration}
                </div>

                <h3 style={{
                  fontFamily: FONT, fontWeight: 800,
                  fontSize: 'clamp(1.3rem,2.5vw,2.35rem)',
                  color: C.text, letterSpacing: '-0.03em',
                  lineHeight: 1.1, marginBottom: '1rem',
                }}>
                  {step.title}
                </h3>

                <p style={{
                  fontFamily: FONT,
                  fontSize: 'clamp(0.875rem,1.2vw,1rem)',
                  color: 'rgba(240,230,211,0.72)',
                  lineHeight: 1.72,
                  margin: '0 0 2rem', maxWidth: '52ch',
                }}>
                  {step.sub}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ display: 'inline-block', width: '1.25rem', height: '1px', background: C.gold, opacity: 0.7 }} />
                  <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.1em' }}>
                    {step.kpi}
                  </span>
                </div>
              </div>

              {i === active && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px',
                  background: `linear-gradient(to bottom, ${C.accent}, ${C.gold})`,
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        /* Safety net invariato */
        .process-step {
          display: block !important;
          visibility: visible !important;
          opacity: 1;
          min-height: 120px;
        }

        /* ═══════════════════════════════════════
          MOBILE  (≤ 899px)
          Ogni regola usa !important solo dove
          serve a vincere specificità inline.
        ═══════════════════════════════════════ */
        @media (max-width: 899px) {

          /* 1. Stack verticale — il fix principale */
          .process-wrapper {
            flex-direction: column;
          }

          /* 2. Pannello sinistro: compact header, non sticky */
          .process-left {
            width: 100% !important;
            position: relative !important;
            height: auto !important;
            /* padding inline ridotto, top/bottom compatti */
            padding: clamp(2.5rem, 7vw, 4rem)
                    clamp(1.2rem, 5vw, 2rem)
                    1.5rem !important;
            overflow: hidden !important;
          }

          /* 3. Numeri ghost: nascosti su mobile
                Senza parallax GSAP sono solo rumore visivo
                che copre il titolo */
          .process-ghost {
            display: none !important;
          }

          /* 4. Titolo h2 nel pannello sinistro:
                font-size già gestita da clamp, solo line-height */
          .process-left h2 {
            margin-bottom: 1.5rem !important;
          }

          /* 5. Pannello destro: padding ragionevole,
                bottom ridotto da clamp(10rem,18vw,18rem) → 4rem */
          .process-right {
            padding:
              0
              clamp(1.2rem, 5vw, 2rem)
              clamp(3rem, 8vw, 4rem)
              clamp(1.2rem, 5vw, 2rem) !important;
          }

          /* 6. Gap tra le card ridotto su schermi piccoli */
          .process-right > * + * {
            margin-top: 0; /* il gap è già inline sullo stack */
          }

          /* 7. Card: rimuove il numero ghost interno su mobile
                (troppo grande, copre il testo nelle card piccole) */
          .process-step > div[style*="position: absolute"] {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════════════
   DATI: STATISTICHE E RECENSIONI
═══════════════════════════════════════════════════════════════ */
const STATS = [
  { value: '34',   unit: '+',  label: 'Progetti consegnati',    detail: 'DAL 2021' },
  { value: '11',   unit: 'GG', label: 'Tempo medio di sviluppo',detail: 'LAVORATIVI' },
  { value: '4.9',  unit: '/5', label: 'Valutazione clienti',    detail: 'VERIFICATE' },
  { value: '100',  unit: '%',  label: 'Codice proprietario',    detail: 'NO TEMPLATE' },
];

const TESTIMONIALS = [
  {
    quote: 'La transizione dai vecchi mockup alla build finale è stata fluida. L\'integrazione del frontend con l\'infrastruttura backend è solida e performante. Ha rispettato le scadenze al millimetro.',
    name: 'Davide M.', role: 'Tech Lead, NovaStudio', initials: 'DM',
  },
  {
    quote: 'Cercavamo uno sviluppatore capace di tradurre interfacce complesse in codice pulito. Il risultato è un sito veloce, accessibile e con animazioni che non pesano sul caricamento.',
    name: 'Giulia R.', role: 'Art Director, Formica', initials: 'GR',
  },
  {
    quote: 'Processo trasparente fin dal giorno zero. Niente costi nascosti e una comunicazione sempre puntuale. Il nuovo applicativo ha abbassato il bounce rate del 28% nel primo mese.',
    name: 'Alessandro B.', role: 'Founder, Krea', initials: 'AB',
  },
];

/* ═══════════════════════════════════════════════════════════════
   ATOM 1: STAT CARD (Design "Hollow")
═══════════════════════════════════════════════════════════════ */
function StatCard({ stat }) {
  return (
    <div className="aww-stat-card" style={{
      padding: 'clamp(2rem, 4vw, 3rem) clamp(1.5rem, 3vw, 2.5rem)',
      background: C.bgDeep,
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden',
      transition: 'background 0.4s ease',
    }}>
      {/* Background Glow invisibile di default */}
      <div className="stat-glow" style={{
        position: 'absolute', inset: 0, opacity: 0,
        background: `radial-gradient(circle at top right, rgba(244,162,97,0.08) 0%, transparent 70%)`,
        transition: 'opacity 0.4s ease',
        pointerEvents: 'none',
      }}/>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.25rem', lineHeight: 0.85 }}>
          <span className="stat-number" style={{
            fontFamily: FONT, fontWeight: 900,
            fontSize: 'clamp(3rem, 7vw, 5.5rem)',
            color: 'transparent',
            WebkitTextStroke: `1px ${C.borderHi}`,
            letterSpacing: '-0.04em',
            transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
          }}>
            {stat.value}
          </span>
          <span style={{
            fontFamily: MONO, fontWeight: 700,
            fontSize: 'clamp(1rem, 2vw, 1.4rem)',
            color: C.accent, opacity: 0.8,
            marginTop: '0.5rem'
          }}>
            {stat.unit}
          </span>
        </div>
      </div>
      
      <div style={{ position: 'relative', zIndex: 1, marginTop: '2rem' }}>
        <div style={{ fontFamily: FONT, fontSize: '1rem', color: C.text, fontWeight: 600 }}>
          {stat.label}
        </div>
        <div style={{ fontFamily: MONO, fontSize: '0.65rem', color: C.muted, letterSpacing: '0.1em', marginTop: '0.3rem' }}>
          [{stat.detail}]
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ATOM 2: TESTIMONIAL EDITORIAL CARD
═══════════════════════════════════════════════════════════════ */
function TestimonialCard() {
  const [active, setActive] = useState(0);
  const DURATION = 7000; // 7 secondi per slide

  useEffect(() => {
    const id = setInterval(() => setActive(p => (p + 1) % TESTIMONIALS.length), DURATION);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      background: `linear-gradient(to bottom right, ${C.bgDeep}, ${C.bg})`,
      border: `1px solid ${C.border}`,
      padding: 'clamp(2.5rem, 5vw, 4.5rem)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      height: '100%',
    }}>
      {/* Elemento grafico oversize "Quote" */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: '-1rem', right: '1rem',
        fontFamily: FONT, fontWeight: 900, fontSize: '14rem',
        color: C.faint, lineHeight: 1, userSelect: 'none',
      }}>
        "
      </div>

      <div style={{ position: 'relative', zIndex: 1, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="testimonial-container" style={{ 
          minHeight: '280px', // O il valore che vedi essere sufficiente per il testo più lungo
          display: 'flex', 
          alignItems: 'center' 
        }}>
          <p key={`quote-${active}`} style={{
            fontFamily: FONT, fontWeight: 400,
            fontSize: 'clamp(1.2rem, 2.5vw, 1.7rem)',
            color: C.text, lineHeight: 1.45, letterSpacing: '-0.01em',
            margin: 0,
            animation: 'revealText 0.8s cubic-bezier(0.16,1,0.3,1) forwards',
          }}>
            {TESTIMONIALS[active].quote}
          </p>
        </div>

        <div key={`auth-${active}`} style={{
          display: 'flex', alignItems: 'center', gap: '1.2rem', marginTop: '3rem',
          animation: 'fadeUp 0.8s 0.15s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <div style={{
            width: '3.5rem', height: '3.5rem', borderRadius: '0.2rem',
            background: C.bgDeep, border: `1px solid ${C.borderHi}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: MONO, fontSize: '0.85rem', color: C.gold, fontWeight: 700,
          }}>
            {TESTIMONIALS[active].initials}
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontSize: '1.1rem', fontWeight: 700, color: C.text }}>
              {TESTIMONIALS[active].name}
            </div>
            <div style={{ fontFamily: MONO, fontSize: '0.7rem', color: C.muted, letterSpacing: '0.08em', marginTop: '0.2rem' }}>
              {TESTIMONIALS[active].role}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar Lineare */}
      <div style={{ width: '100%', height: '2px', background: C.rail, marginTop: '3rem', position: 'relative' }}>
        <div key={`progress-${active}`} style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          background: C.accent,
          animation: `progressLine ${DURATION}ms linear forwards`
        }}/>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ORGANISM: SEZIONE PRINCIPALE (Bento Layout)
═══════════════════════════════════════════════════════════════ */
function StatsSection() {
  const sectionRef = useRef(null);

  return (
    <section ref={sectionRef} style={{
      background: C.bgDeep,
      borderTop: `1px solid ${C.faint}`,
      padding: 'clamp(5rem, 12vw, 10rem) clamp(1rem, 5vw, 4rem)',
      position: 'relative'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header Sezione */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          marginBottom: 'clamp(3rem, 6vw, 5rem)', borderBottom: `1px solid ${C.faint}`,
          paddingBottom: '2rem', flexWrap: 'wrap', gap: '2rem'
        }}>
          <h2 style={{
            fontFamily: FONT, fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            color: C.text, margin: 0, letterSpacing: '-0.03em', lineHeight: 1
          }}>
            Impatto Misurabile.
          </h2>
          <span style={{
            fontFamily: MONO, fontSize: '0.7rem', color: C.accent,
            letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>
            [ 04 / ANALITICA & CLIENTI ]
          </span>
        </div>

        {/* BENTO GRID LAYOUT */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))',
          gap: 'clamp(1rem, 3vw, 2rem)',
          alignItems: 'stretch'
        }}>
          
          {/* Colonna Sinistra: Griglia Statistiche 2x2 */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1px', background: C.faint, border: `1px solid ${C.faint}`
          }}>
            {STATS.map((stat, index) => (
              <StatCard key={index} stat={stat} />
            ))}
          </div>

          {/* Colonna Destra: Testimonial */}
          <div>
            <TestimonialCard />
          </div>

        </div>
      </div>

      <style>{`
        /* Animazioni Keyframes */
        @keyframes revealText {
          0% { opacity: 0; transform: translateY(10px) skewY(1deg); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0) skewY(0); filter: blur(0); }
        }
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(15px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressLine {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        
        /* Effetti Hover Desktop */
        @media (hover: hover) and (pointer: fine) {
          .aww-stat-card:hover .stat-number {
            color: ${C.text} !important;
            -webkit-text-stroke: 0px transparent !important;
            transform: scale(1.05) translateY(-5px);
          }
          .aww-stat-card:hover .stat-glow {
            opacity: 1 !important;
          }
        }
      `}</style>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONTACT SECTION — Robot-Guardian Edition (Mobile-Fixed & Scroll-Optimized)

   Questo file estende la ContactSection originale integrando il modello 3D
   <RobotSpline /> come "guardiano" della CTA finale, SENZA rompere nessuna
   delle ottimizzazioni anti-overflow iOS già presenti.

   ── Modifiche rispetto all'originale ─────────────────────────────
   ①-⑦  INVARIATE: tutte le fix originali (overflowX wrapper, translateZ del
        marquee, clamp tipografici, invalidateOnRefresh, width:max-content…)
        sono mantenute byte-per-byte. CyberBackground / EndlessMarquee /
        MagneticCTA NON sono stati toccati.
   ⑧  STYLE INJECTION: layout responsive desktop-split / mobile-column gestito
        via <style> scoping (le media query non sono esprimibili inline). Il
        testo passa da "tutto centrato" (mobile) a colonna sinistra (≥1024px),
        liberando la metà destra per il robot.
   ⑨  ROBOT 3D: <RobotSpline /> inserito FRA il marquee e il content.
        z-order rigoroso: CyberBackground → EndlessMarquee → RobotSpline(z:2)
        → Content+CTA(z:5). Il canvas è pointer-events:none → i tap sulla CTA
        passano sempre, lo scroll mobile non viene mai rubato.

   ⚠ DIPENDENZE ESTERNE (già presenti nel file dove vive la ContactSection):
     React (useRef/useEffect/useState/useCallback), gsap, Link (react-router),
     l'icona Crosshair, e le costanti C { bg, accent, muted }, FONT, MONO.
   ⬇ UNICO import NUOVO da aggiungere in cima al tuo file:
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   ATOM 1: CYBER BACKGROUND (Grid + Scanlines + Vignette)
   Invariato — nessun bug qui.
═══════════════════════════════════════════════════════════════ */
function CyberBackground() {
  return (
    <>
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: C.accent,
        backgroundImage: [
          'radial-gradient(circle, rgba(5,3,2,0.15) 1px, transparent 1px)',
          'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(5,3,2,0.25) 100%)',
        ].join(', '),
        backgroundSize: '24px 24px, 100% 100%',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent, transparent 3px,
          rgba(5,3,2,0.035) 3px, rgba(5,3,2,0.035) 4px
        )`,
      }} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ATOM 2: ENDLESS MARQUEE SCROLL (ScrollTrigger Ottimizzato)
   Invariato — translateZ(0) compositor fix + invalidateOnRefresh intatti.
═══════════════════════════════════════════════════════════════ */
function EndlessMarquee({ sectionRef }) {
  const marqueeRef = useRef(null);

  useEffect(() => {
    const el = marqueeRef.current;
    if (!el || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.to(el, {
        xPercent: -25,
        ease: 'none',
        force3D: true,
        scrollTrigger: {
          trigger: sectionRef.current,
          scrub: 1.2,
          start: 'top bottom',
          end: 'bottom top',
          /* ⑥ invalidateOnRefresh: true → al resize (orientamento mobile,
             barra URL Safari) ScrollTrigger ricalcola start/end/pin senza
             produrre un layout jump o un salto brusco nell'animazione scrub */
          invalidateOnRefresh: true,
          onEnter:     () => { el.style.willChange = 'transform'; },
          onLeave:     () => { el.style.willChange = 'auto'; },
          onEnterBack: () => { el.style.willChange = 'transform'; },
          onLeaveBack: () => { el.style.willChange = 'auto'; },
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [sectionRef]);

  return (
    /*  ② Il wrapper ha già overflow:hidden + position:absolute (corretto).
        Bug iOS Safari: overflow:hidden su elementi absolutely-positioned
        non clippa i figli durante il compositing GPU → si vede il marquee
        scorrere fuori dai bordi della section su scroll veloce.
        Fix: transform:'translateZ(0)' promuove questo div su un layer
        compositor indipendente → Safari rispetta il clipping nel proprio
        layer, risolvendo il bug senza toccare il resto del layout.        */
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, zIndex: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      /* ② iOS Safari overflow:hidden compositor-layer fix */
      transform: 'translateZ(0)',
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: 0,
        transform: 'translateY(-50%)',
        /*  ⑦ Rimosso width:'200%' — il flex container si dimensiona al
            contenuto reale (max-content). Con width:'200%', il div veniva
            forzato a 200vw: se il testo era più largo, overflowava il
            contenitore generando un rettangolo di larghezza incoerente che
            alcuni browser consideravano nel calcolo dello scroll-width.
            Con max-content il div è esattamente largo quanto il suo contenuto
            e il transform:translateZ(0) del genitore garantisce il clip.     */
        width: 'max-content',
        display: 'flex',
        opacity: 0.08,
      }}>
        <div ref={marqueeRef} style={{
          display: 'flex',
          gap: '3rem',
          whiteSpace: 'nowrap',
          fontFamily: FONT,
          fontWeight: 900,
          /*  ③ Font size marquee — clamp(2.5rem, 12vw, 22rem): su 375px una
              parola per volta resta leggibile; su 768px+ testo grande e scenico. */
          fontSize: 'clamp(2.5rem, 12vw, 22rem)',
          lineHeight: 0.8,
          color: C.bg,
        }}>
          <span>LET'S BUILD ◈</span>
          <span style={{ color: 'transparent', WebkitTextStroke: `2px ${C.bg}` }}>PREMIUM FRONTEND ◈</span>
          <span>SCALABLE PYTHON BACKEND ◈</span>
          <span style={{ color: 'transparent', WebkitTextStroke: `2px ${C.bg}` }}>LET'S BUILD ◈</span>
          <span>PREMIUM FRONTEND ◈</span>
          {/* Span extra: serve a riempire il gap quando il font è piccolo su mobile */}
          <span>SCALABLE PYTHON BACKEND ◈</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ATOM 3: MAGNETIC CTA BUTTON
   Invariato — già ben gestito per mobile (maxWidth, clamp padding,
   wordBreak fallback, handler touch). Nessun bug qui.
═══════════════════════════════════════════════════════════════ */
// Aggiungi onHoverChange alle props
function MagneticCTA({ audio, onHoverChange }) {
  const btnRef   = useRef(null);
  const arrowRef = useRef(null);
  const [hov, setHov] = useState(false);

  const handleEnter = useCallback(() => {
    audio?.tick?.();
    setHov(true);
    onHoverChange?.(true); // <--- INVIA SEGNALE AL PADRE: HOVER ATTIVO
    const arrow = arrowRef.current;
    if (!arrow) return;
    gsap.killTweensOf(arrow);
    gsap.to(arrow, {
      x: 12, y: -12, opacity: 0,
      duration: 0.18, ease: 'power2.in',
      onComplete: () => {
        gsap.set(arrow, { x: -12, y: 12 });
        gsap.to(arrow, { x: 0, y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
      },
    });
  }, [audio, onHoverChange]); // <--- Aggiungilo alle dipendenze

  const handleLeave = useCallback(() => {
    setHov(false);
    onHoverChange?.(false); // <--- INVIA SEGNALE AL PADRE: HOVER FINITO
    const arrow = arrowRef.current;
    if (!arrow) return;
    gsap.killTweensOf(arrow);
    gsap.to(arrow, { x: 0, y: 0, opacity: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
  }, [onHoverChange]); 


  const handlePress = useCallback(() => audio?.beep?.(), [audio]);

  const handleTouch = useCallback(() => {
    audio?.tick?.();
    setTimeout(() => audio?.beep?.(), 90);
  }, [audio]);

  return (
    <div ref={btnRef} className="magnetic-wrapper" style={{ display: 'inline-block', maxWidth: '100%' }}>
      <Link
        to="/contact"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onMouseDown={handlePress}
        onTouchStart={handleTouch}
        style={{
          display: 'inline-flex', alignItems: 'center',
          gap: 'clamp(0.5rem, 1.5vw, 1rem)',
          padding: 'clamp(1rem, 2.5vw, 1.8rem) clamp(1.2rem, 3.5vw, 4.5rem)',
          maxWidth: 'calc(100vw - 3rem)',
          background: hov ? 'transparent' : C.bg,
          border: `2px solid ${hov ? C.bg : 'transparent'}`,
          borderRadius: '0.2rem',
          fontSize: 'clamp(0.75rem, 4vw, 1.2rem)',
          fontFamily: FONT, fontWeight: 700,
          color: hov ? C.bg : C.accent,
          textDecoration: 'none', letterSpacing: '0.03em',
          transition: 'background 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: hov
            ? '0 0 0 4px rgba(5,3,2,0.1), 0 24px 48px rgba(5,3,2,0.25)'
            : '0 8px 32px rgba(5,3,2,0.15)',
          cursor: 'pointer',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <Crosshair color={hov ? C.bg : C.accent} size={16} style={{ flexShrink: 0 }} />
        <span style={{ minWidth: 0, wordBreak: 'break-all' }}>
          Fissa una call!
        </span>
        <span ref={arrowRef} style={{
          fontFamily: MONO,
          fontSize: 'clamp(0.8rem, 1.5vw, 1rem)',
          color: hov ? C.bg : C.muted,
          display: 'inline-block', willChange: 'transform',
          flexShrink: 0, marginLeft: '0.2rem',
          transition: 'color 0.35s ease',
        }}>
          ↗
        </span>
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ORGANISM: CONTACT SECTION MAIN  (Robot-Guardian Layout)
═══════════════════════════════════════════════════════════════ */
function ContactSection({ audio }) {
  const sectionRef = useRef(null);

  const [ctaHovered, setCtaHovered] = useState(false);

  return (
    /*  ① WRAPPER per il clip orizzontale del marquee — INVARIATO.
        overflowX:'hidden' sul WRAPPER (non sulla <section>) isola il marquee
        senza clippare il bottone magnetico né il robot (entrambi dentro la
        section). position:relative qui NON è il containing block del robot:
        il robot è absolute rispetto alla <section> (che è position:relative). */
    <div style={{ overflowX: 'hidden', position: 'relative' }}>

      {/*  ⑧ STYLE INJECTION — Layout responsive (desktop split / mobile column).
          Inline-style non supporta le media query: qui le regole sono scopate
          sotto .awwwards-contact, quindi non perdono nulla rispetto agli inline
          originali e cambiano SOLO allineamento e larghezza colonna.            */}
      <style>{`
        /* MOBILE-FIRST (≤1023px): tutto centrato, identico all'originale */
        .awwwards-contact .contact-content{
          position:relative;
          z-index:5;                       /* sopra al robot (z:2) → CTA cliccabile */
          padding:0 1.5rem;
          text-align:center;
        }
        .awwwards-contact .contact-eyebrow{ justify-content:center; }

        /* DESKTOP (≥1024px): composizione asimmetrica.
           Testo a sinistra (colonna max ~560px), metà destra libera per il robot. */
        @media (min-width:1024px){
          .awwwards-contact{
            min-height:clamp(520px, 64svh, 820px);  /* stage verticale per il robot */
          }
          .awwwards-contact .contact-content{
            text-align:left;
            width:100%;
            max-width:min(560px, 48vw);
            margin-left:clamp(2rem, 7vw, 7rem);
            padding-right:2rem;
          }
          .awwwards-contact .contact-eyebrow{ justify-content:flex-start; }
        }
      `}</style>

      <section
        id="contact-section"
        ref={sectionRef}
        className="awwwards-contact"
        style={{
          /*  ④ Padding verticale clamp(4rem, 12vw, 18rem): su 320px = 64px,
              su 768px ≈ 92px, su 1440px = 288px (invariato dal design). */
          padding: 'clamp(4rem, 12vw, 18rem) 0',
          position: 'relative',
          /* textAlign rimosso dall'inline → ora gestito da .contact-content
             (centrato su mobile, a sinistra su desktop). Gli atomi assoluti
             (CyberBackground / Marquee) non dipendono da textAlign.            */
        }}
      >
        {/* z:0/1 — sfondo */}
        <CyberBackground />
        {/* z:0 — testo marquee animato */}
        <EndlessMarquee sectionRef={sectionRef} />

        {/*  ⑨ ROBOT 3D GUARDIANO — z:2 (fra marquee e content).
            • Si auto-posiziona: desktop = metà destra (absolute right:0, 48%,
              top:50% translateY(-50%)); mobile = dietro al titolo, opacità 0.22.
            • Kill-switch: play() quando la section entra nel viewport, stop()
              quando esce → zero carico GPU/CPU in background.
            • pointer-events:none → non ruba scroll/tap: la CTA resta cliccabile.
            • Passo sectionRef così l'observer del robot osserva ESATTAMENTE
              questa sezione. (Per abilitare hover/LookAt solo su desktop:
              <RobotSpline sectionRef={sectionRef} enableDesktopHover />)        */}
        <RobotSpline 
          sectionRef={sectionRef} 
          enableDesktopHover={true} 
          isHovered={ctaHovered} 
        />

        {/* z:5 — contenuto testuale + CTA, sempre sopra al robot */}
        <div className="contact-content">

          <p className="contact-eyebrow" style={{
            fontFamily: MONO, fontSize: '0.7rem',
            color: 'rgba(5,3,2,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase',
            marginBottom: '2.5rem',
            /* justifyContent rimosso dall'inline → ora responsive via .contact-eyebrow */
            display: 'flex', alignItems: 'center', gap: '0.8rem',
          }}>
            <Crosshair color="rgba(5,3,2,0.5)" size={12} />
            [ 05 / AVVIA PROGETTO ]
          </p>

          {/*  ⑤ h2 clamp(2rem, 9vw, 9rem): nessun overflow di "Facciamo qualcosa"
               a 320px, impattante su desktop. Allineamento ereditato da
               .contact-content (centro su mobile, sinistra su desktop).         */}
          <h2 style={{
            fontFamily: FONT, fontWeight: 900,
            fontSize: 'clamp(2rem, 9vw, 9rem)',
            letterSpacing: '-0.04em', 
            lineHeight: 0.9, /* ⬅️ MANTENUTO COMPATTO */
            color: C.bg, marginBottom: 'clamp(1.0rem, 3.0vw, 2.0rem)',
            textShadow: '0 10px 30px rgba(5,3,2,0.1)',
          }}>
            Facciamo qualcosa<br />
            {/* ⬇️ IL TRUCCO: Spingiamo in giù solo questa riga di 8-10 pixel */}
            <span style={{ display: 'inline-block', transform: 'translateY(0.08em)' }}>di</span><br />
            straordinario.
          </h2>

          <MagneticCTA audio={audio} onHoverChange={setCtaHovered} />

          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
            marginTop: 'clamp(3rem, 5vw, 4rem)',
          }}>
            <p style={{
              fontFamily: MONO, fontSize: '0.65rem',
              color: 'rgba(5,3,2,0.45)', letterSpacing: '0.15em', textTransform: 'uppercase',
              margin: 0, userSelect: 'none',
            }}>
              Rispondo entro 24h ◈ Operativo worldwide
            </p>
          </div>

        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT EXPORT
═══════════════════════════════════════════════════════════════ */
const Sections = () => (
  <>
    <RailLines />

    <div
      id="main-sections"
      style={{
        position: 'relative',
        zIndex: 2,
        background: C.bg,
        isolation: 'isolate',
      }}
    >
      <ServicesSection />
      <WorkSection />
      <ProcessSection />
      <Manifesto />
      <StatsSection />
      <LabSection />
      <TechStack />
      <KineticCanvas />
      <StressTestSection />
      <FAQ />
      <InvestmentSection />
      <ContactSection />
    </div>

    <Footer />

    <style>{`
      @keyframes fadeSlide {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .bento-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .bento-large {
        grid-column: span 2;
        grid-row: span 2;
      }

      .stats-grid { grid-template-columns: repeat(4, 1fr); }

      .work-section {
        min-height: 100svh;
        display: flex;
        flex-direction: column;
      }
      .work-track {
        gap: clamp(0.75rem, 2.5vw, 2.5rem);
        width: fit-content;
        padding-bottom: clamp(2rem, 4vw, 4rem);
      }

      @media (hover: hover) and (pointer: fine) {
        .bento-card:hover {
          border-color: ${C.borderHi} !important;
          transform: translateY(-5px);
        }
        .bento-card:hover .bento-glow { opacity: 1 !important; }
        .bento-card:hover .bento-icon { transform: scale(1.12) rotate(5deg); }

        .work-card:hover { border-color: rgba(244,162,97,0.3) !important; }
        .work-card:hover .wc-line { transform: scaleX(1) !important; }

        .contact-btn:hover {
          transform: scale(1.04) !important;
          box-shadow: 0 28px 56px rgba(0,0,0,0.45) !important;
        }
      }

      @media (max-width: 1024px) {
        .bento-grid { grid-template-columns: repeat(2, 1fr); }
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
      }

      /* Process: responsive gestito dalla <style> interna al componente */

      @media (max-width: 767px) {
        .work-section { min-height: auto !important; }
        .work-track {
          flex-direction: column !important;
          width: 100% !important;
          gap: 1rem !important;
          padding-left: 1.5rem !important;
          padding-right: 1.5rem !important;
        }
        .work-section .work-track > div {
          width: 100% !important;
          height: auto !important;
          aspect-ratio: 4 / 5;
          align-self: auto !important;
          margin-right: 0 !important;
        }

        .bento-grid { grid-template-columns: 1fr !important; }
        .bento-large { grid-column: 1 !important; grid-row: auto !important; }

        .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration:   0.01ms !important;
          transition-duration:  0.01ms !important;
          animation-iteration-count: 1 !important;
        }
      }
    `}</style>
  </>
);

export default Sections;