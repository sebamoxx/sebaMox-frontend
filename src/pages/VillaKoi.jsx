import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SEO from '../components/SEO';

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — "Sumi-e Zen" (inchiostro, ossa, una sola pennellata Koi)
   ─────────────────────────────────────────────────────────────
   Palette volutamente diversa dalle altre case study (mandato di
   varianza): base inchiostro freddo, tipografia serif ad alto
   contrasto, un unico accento argilla/persimmone usato col
   contagocce. Calma prima di tutto.
═══════════════════════════════════════════════════════════════ */
const C = {
  ink:     '#0A0A0B', // base — nero inchiostro
  sumi:    '#0E0E11', // pannello sollevato
  mist:    '#141418', // card
  bone:    '#ECE9E2', // testo
  muted:   'rgba(236,233,226,0.46)',
  faint:   'rgba(236,233,226,0.12)',
  hair:    'rgba(236,233,226,0.07)',
  koi:     '#C0603E', // argilla/persimmone — accento Koi (parsimonia)
  koiSoft: 'rgba(192,96,62,0.42)',
  koiMist: 'rgba(192,96,62,0.10)',
};
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS  = "'Outfit', 'Geist', system-ui, sans-serif";
const MONO  = "'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', Menlo, monospace";
const EASE  = 'cubic-bezier(0.32, 0.72, 0, 1)'; // curva firma del sito

/* Immagine hero: intrinseca 1376×768 (≈16:9). Il contenitore riserva
   il rapporto → zero CLS anche prima del caricamento. */
const HERO_VIDEO = '/videos/videoCarpeKoi.mp4';

/* ═══════════════════════════════════════════════════════════════
   CSS — iniettato una volta. MOBILE-FIRST: le regole base valgono
   per gli schermi piccoli; @media (min-width:768px) le potenzia.
═══════════════════════════════════════════════════════════════ */
const CSS = `
  .vk-root *, .vk-root *::before, .vk-root *::after {
    box-sizing: border-box; margin: 0; padding: 0;
  }

  .vk-root {
    background: ${C.ink};
    color: ${C.bone};
    font-family: ${SANS};
    min-height: 100svh;
    overflow-x: clip;
    position: relative;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Grana sumi-e: overlay FISSO, pointer-events none (perf: mai su
        contenitore in scroll). Texture "carta" che scalda l'inchiostro. ── */
  .vk-grain {
    position: fixed;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    opacity: 0.035;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  /* ── Wrapper di lettura: tanta aria ai lati ── */
  .vk-wrap {
    width: 100%;
    max-width: 1180px;
    margin: 0 auto;
    padding-left: clamp(1.25rem, 5vw, 4rem);
    padding-right: clamp(1.25rem, 5vw, 4rem);
    position: relative;
    z-index: 1;
  }

  /* ── Back button (pill leggera, niente bordo grigio generico) ── */
  .vk-back {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    font-family: ${MONO};
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${C.muted};
    text-decoration: none;
    padding: 0.55rem 1rem 0.55rem 0.85rem;
    border-radius: 100px;
    border: 1px solid ${C.hair};
    background: rgba(236,233,226,0.02);
    transition: color 0.6s ${EASE}, border-color 0.6s ${EASE}, background 0.6s ${EASE}, transform 0.4s ${EASE};
  }
  .vk-back:hover {
    color: ${C.bone};
    border-color: ${C.faint};
    background: rgba(236,233,226,0.04);
  }
  .vk-back:active { transform: scale(0.98); }
  .vk-back .vk-back-arrow { transition: transform 0.5s ${EASE}; }
  .vk-back:hover .vk-back-arrow { transform: translateX(-3px); }

  /* ── Eyebrow microscopica ── */
  .vk-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-family: ${MONO};
    font-size: 0.68rem;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: ${C.koi};
  }
  .vk-eyebrow::before {
    content: '';
    width: 26px;
    height: 1px;
    background: ${C.koiSoft};
    display: inline-block;
  }

  /* ── Titolo display serif ── */
  .vk-title {
    font-family: ${SERIF};
    font-weight: 600;
    font-size: clamp(3.4rem, 13vw, 8.5rem);
    line-height: 0.92;
    letter-spacing: -0.02em;
    margin-top: 1.5rem;
  }
  .vk-title em {
    font-style: italic;
    font-weight: 400;
    color: ${C.koi};
  }

  /* ── Lede / sottotitolo ── */
  .vk-lede {
    font-family: ${SERIF};
    font-weight: 300;
    font-size: clamp(1.25rem, 2.6vw, 1.85rem);
    line-height: 1.5;
    color: rgba(236,233,226,0.74);
    max-width: 30ch;
    margin-top: 1.75rem;
  }

  /* ════ DOUBLE-BEZEL HERO FRAME ════
     Outer shell (vassoio) + inner core (lastra): curve concentriche. */
  .vk-hero-figure { margin-top: clamp(2.5rem, 6vw, 4.5rem); }
  .vk-hero-shell {
    padding: 0.5rem;
    border-radius: 1.75rem;
    background: rgba(236,233,226,0.03);
    border: 1px solid ${C.hair};
    box-shadow: 0 40px 120px -40px rgba(0,0,0,0.8);
  }
  .vk-hero-core {
    position: relative;
    overflow: hidden;
    border-radius: 1.25rem; /* calc(1.75rem - 0.5rem) */
    aspect-ratio: 16 / 9;
    background: ${C.sumi};
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.06);
  }
  .vk-hero-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    will-change: transform; /* solo qui: subisce il parallax */
    transition: opacity 0.8s ${EASE};
  }
  /* Fallback rivelato se l'immagine non carica (img → opacity 0) */
  .vk-hero-fallback {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background:
      radial-gradient(ellipse at 50% 35%, ${C.koiMist} 0%, transparent 60%),
      linear-gradient(160deg, ${C.mist} 0%, ${C.ink} 100%);
    color: ${C.muted};
    z-index: 0;
  }
  .vk-hero-fallback .vk-kanji {
    font-family: ${SERIF};
    font-size: clamp(3rem, 12vw, 6rem);
    color: ${C.koiSoft};
    line-height: 1;
  }
  .vk-hero-fallback .vk-kanji-label {
    font-family: ${MONO};
    font-size: 0.66rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
  }
  .vk-hero-img { z-index: 1; }
  /* Vignetta + velo per integrare l'immagine nell'inchiostro */
  .vk-hero-veil {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background:
      linear-gradient(180deg, transparent 55%, rgba(10,10,11,0.45) 100%),
      radial-gradient(ellipse at center, transparent 62%, rgba(10,10,11,0.4) 100%);
  }
  .vk-hero-tag {
    position: absolute;
    left: 1rem;
    bottom: 1rem;
    z-index: 3;
    font-family: ${MONO};
    font-size: 0.64rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(236,233,226,0.7);
    background: rgba(10,10,11,0.5);
    backdrop-filter: blur(6px);
    border: 1px solid ${C.hair};
    padding: 0.4rem 0.7rem;
    border-radius: 100px;
  }

  /* ── Barra metadati ── */
  .vk-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 2.5rem 3.5rem;
    margin-top: clamp(2.5rem, 6vw, 4rem);
  }
  .vk-meta-item { display: flex; flex-direction: column; gap: 0.5rem; }
  .vk-meta-k {
    font-family: ${MONO};
    font-size: 0.64rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${C.muted};
  }
  .vk-meta-v {
    font-family: ${SERIF};
    font-size: clamp(1.15rem, 2.4vw, 1.5rem);
    font-weight: 500;
    color: ${C.bone};
  }
  .vk-stack { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .vk-chip {
    font-family: ${MONO};
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    color: rgba(236,233,226,0.78);
    border: 1px solid ${C.faint};
    border-radius: 100px;
    padding: 0.35rem 0.8rem;
  }

  /* ── Riga ornamentale (ensō minimale) ── */
  .vk-rule {
    position: relative;
    height: 1px;
    background: ${C.hair};
    margin: clamp(4.5rem, 11vw, 8rem) 0;
  }
  .vk-rule::after {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 9px; height: 9px;
    border-radius: 50%;
    border: 1px solid ${C.koiSoft};
    background: ${C.ink};
  }

  /* ── Sezioni editoriali ── */
  .vk-section-eyebrow {
    font-family: ${MONO};
    font-size: 0.66rem;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: ${C.muted};
    display: block;
    margin-bottom: 1.5rem;
  }
  .vk-h2 {
    font-family: ${SERIF};
    font-weight: 500;
    font-size: clamp(2.1rem, 6vw, 3.6rem);
    line-height: 1.05;
    letter-spacing: -0.015em;
  }
  .vk-h2 em { font-style: italic; font-weight: 400; color: ${C.koi}; }

  .vk-prose {
    font-family: ${SANS};
    font-weight: 300;
    font-size: clamp(1.02rem, 1.9vw, 1.22rem);
    line-height: 1.85;
    color: rgba(236,233,226,0.66);
    max-width: 62ch;
    margin-top: 1.75rem;
  }
  .vk-prose + .vk-prose { margin-top: 1.5rem; }
  .vk-prose strong { color: ${C.bone}; font-weight: 500; }

  /* ── Griglia deep-dive: MOBILE-FIRST single-column ── */
  .vk-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-top: clamp(2.5rem, 6vw, 4rem);
  }

  /* Card double-bezel */
  .vk-card-shell {
    padding: 0.5rem;
    border-radius: 1.6rem;
    background: rgba(236,233,226,0.025);
    border: 1px solid ${C.hair};
    transition: border-color 0.7s ${EASE}, background 0.7s ${EASE}, transform 0.7s ${EASE};
  }
  .vk-card-shell:hover {
    border-color: ${C.koiSoft};
    background: rgba(192,96,62,0.04);
    transform: translateY(-4px);
  }
  .vk-card-core {
    height: 100%;
    border-radius: 1.15rem;
    background: ${C.sumi};
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.05);
    padding: clamp(1.75rem, 4vw, 2.75rem);
  }
  .vk-card-num {
    font-family: ${MONO};
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    color: ${C.koi};
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .vk-card-title {
    font-family: ${SERIF};
    font-weight: 500;
    font-size: clamp(1.6rem, 3.4vw, 2.1rem);
    line-height: 1.1;
    margin: 1.25rem 0 0;
  }
  .vk-card-body {
    font-family: ${SANS};
    font-weight: 300;
    font-size: clamp(0.98rem, 1.7vw, 1.08rem);
    line-height: 1.8;
    color: rgba(236,233,226,0.62);
    margin-top: 1.1rem;
  }
  .vk-card-body strong { color: ${C.bone}; font-weight: 500; }
  .vk-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1.75rem;
    padding-top: 1.5rem;
    border-top: 1px solid ${C.hair};
  }

  /* ════ CTA — button-in-button ════ */
  .vk-cta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: clamp(2.5rem, 6vw, 3.5rem);
  }
  .vk-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.55rem 0.6rem 0.55rem 1.6rem;
    border-radius: 100px;
    text-decoration: none;
    font-family: ${SANS};
    font-size: 0.98rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    transition: transform 0.5s ${EASE}, background 0.6s ${EASE}, box-shadow 0.6s ${EASE}, color 0.6s ${EASE}, border-color 0.6s ${EASE};
  }
  .vk-cta-primary {
    background: ${C.bone};
    color: ${C.ink};
  }
  .vk-cta-primary:hover {
    box-shadow: 0 20px 50px -18px rgba(236,233,226,0.4);
  }
  .vk-cta-primary:active { transform: scale(0.98); }
  .vk-cta-ghost {
    background: transparent;
    color: ${C.bone};
    border: 1px solid ${C.faint};
  }
  .vk-cta-ghost:hover {
    border-color: ${C.koiSoft};
    color: ${C.koi};
    background: ${C.koiMist};
  }
  .vk-cta-ghost:active { transform: scale(0.98); }
  /* Cerchio icona annidato (button-in-button) */
  .vk-cta-icon {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform 0.5s ${EASE}, background 0.6s ${EASE};
  }
  .vk-cta-primary .vk-cta-icon { background: rgba(10,10,11,0.08); }
  .vk-cta-ghost .vk-cta-icon { background: rgba(236,233,226,0.06); }
  .vk-cta:hover .vk-cta-icon {
    transform: translate(2px, -2px) scale(1.05);
  }
  .vk-cta-icon svg { width: 14px; height: 14px; display: block; }

  /* ── Footer leggero ── */
  .vk-foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: clamp(4rem, 9vw, 7rem) 0 clamp(3rem, 6vw, 5rem);
    font-family: ${MONO};
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${C.muted};
  }

  /* ════ DESKTOP ENHANCE (mobile-first → ≥768px) ════ */
  @media (min-width: 768px) {
    .vk-grid { grid-template-columns: 1fr 1fr; gap: 1.75rem; }
    .vk-hero-tag { left: 1.25rem; bottom: 1.25rem; }
  }

  /* ════ ACCESSIBILITÀ — prefers-reduced-motion ════
     Annulla ogni transizione/animazione. Le entrate GSAP vengono
     saltate via JS (vedi useEffect), quindi senza JS o con reduced
     motion il contenuto è SEMPRE visibile (nessun opacity:0 in CSS). */
  @media (prefers-reduced-motion: reduce) {
    .vk-root *, .vk-root *::before, .vk-root *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
    .vk-hero-img { will-change: auto; }
  }
`;

/* ───────────────────────────────────────────────────────────────
   Icona freccia ultra-light (niente librerie di icone)
─────────────────────────────────────────────────────────────── */
const ArrowUpRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17L17 7" />
    <path d="M8 7h9v9" />
  </svg>
);

const ArrowLeft = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"
       aria-hidden="true">
    <path d="M19 12H5" />
    <path d="M11 6l-6 6 6 6" />
  </svg>
);

/* ───────────────────────────────────────────────────────────────
   Card del Deep-Dive tecnico
─────────────────────────────────────────────────────────────── */
function DeepDiveCard({ num, title, tags, children }) {
  return (
    <article className="vk-card-shell" data-reveal>
      <div className="vk-card-core">
        <span className="vk-card-num">{num} <span style={{ color: C.muted }}>//</span></span>
        <h3 className="vk-card-title">{title}</h3>
        <p className="vk-card-body">{children}</p>
        <div className="vk-card-tags">
          {tags.map((t) => (
            <span key={t} className="vk-chip">{t}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGINA villaKoi
═══════════════════════════════════════════════════════════════ */
export default function VillaKoi() {
  const pageRef = useRef(null);
  const heroImgRef = useRef(null);

  useEffect(() => {
    // Rispetta "riduci movimento": niente entrate animate né parallax.
    // Senza opacity:0 in CSS, il contenuto resta già visibile → accessibile
    // anche con JS disattivato.
    const prefersReduced =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      /* ── Entrata hero (transform + opacity → GPU-safe, niente reflow) ── */
      gsap.fromTo(
        '[data-hero] > *',
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, ease: 'power3.out', delay: 0.1 }
      );

      /* ── Reveal delle sezioni allo scroll ── */
      gsap.utils.toArray('[data-reveal]').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 40 },
          {
            opacity: 1, y: 0, duration: 1, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 85%' },
          }
        );
      });

      /* ── Parallax "out-of-bounds" misurato sull'immagine hero
            (solo transform: zero impatto sul layout / CLS) ── */
      if (heroImgRef.current) {
        gsap.fromTo(
          heroImgRef.current,
          { yPercent: -6, scale: 1.08 },
          {
            yPercent: 6, scale: 1.08, ease: 'none',
            scrollTrigger: {
              trigger: heroImgRef.current.closest('.vk-hero-core'),
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          }
        );
      }
    }, pageRef);

    // Refresh di sicurezza dopo il mount (coerente con le altre case study).
    const refreshTimer = setTimeout(() => ScrollTrigger.refresh(true), 300);

    return () => {
      clearTimeout(refreshTimer);
      ctx.revert();
    };
  }, []);

  return (
    <>
      {/* SEO dinamica (fonte: src/seo.config.js per /projects/VillaKoi) */}
      <SEO />
      <style>{CSS}</style>

      <main ref={pageRef} className="vk-root">
        <div className="vk-grain" aria-hidden="true" />

        {/* ════ HERO ════ */}
        <header className="vk-wrap" data-hero style={{ paddingTop: 'clamp(2rem, 6vw, 4.5rem)' }}>
          <div style={{ marginBottom: 'clamp(2.5rem, 6vw, 4rem)' }}>
            <Link to="/" state={{ scrollToWorks: true }} className="vk-back">
              <ArrowLeft className="vk-back-arrow" />
              Torna ai progetti
            </Link>
          </div>

          <span className="vk-eyebrow">Case Study // Index 02</span>

          <h1 className="vk-title">
            villa<em>Koi</em>
          </h1>

          <p className="vk-lede">
            Tradurre la pazienza dell&rsquo;acqua in un&rsquo;esperienza digitale.
          </p>

          {/* ── HERO: SOLO IMMAGINE STATICA (nessun tag video) ── */}
          <figure className="vk-hero-figure">
            <div className="vk-hero-shell">
              <div className="vk-hero-core">
                {/* Fallback dietro l'immagine: rivelato se il load fallisce */}
                <div className="vk-hero-fallback" aria-hidden="true">
                  <span className="vk-kanji">鯉</span>
                  <span className="vk-kanji-label">villaKoi</span>
                </div>

                <video
                  ref={heroImgRef}
                  className="vk-hero-img"
                  src={HERO_VIDEO}
                  autoPlay
                  muted
                  loop
                  playsInline
                />

                <div className="vk-hero-veil" aria-hidden="true" />
                <span className="vk-hero-tag">鯉 — Prima pagina d'impatto</span>
              </div>
            </div>
          </figure>

          {/* ── Metadati ── */}
          <div className="vk-meta">
            <div className="vk-meta-item">
              <span className="vk-meta-k">Ruolo</span>
              <span className="vk-meta-v">Full-Stack Developer</span>
            </div>
            <div className="vk-meta-item">
              <span className="vk-meta-k">Anno</span>
              <span className="vk-meta-v">2026</span>
            </div>
            <div className="vk-meta-item">
              <span className="vk-meta-k">Stack</span>
              <div className="vk-stack" style={{ marginTop: '0.15rem' }}>
                <span className="vk-chip">React</span>
                <span className="vk-chip">FastAPI</span>
                <span className="vk-chip">GSAP</span>
              </div>
            </div>
          </div>
        </header>

        {/* ════ IL CONCEPT ════ */}
        <section className="vk-wrap" data-reveal>
          <div className="vk-rule" />
          <span className="vk-section-eyebrow">01 — Il Concept</span>
          <h2 className="vk-h2">
            La calma come <em>materiale</em> di progetto.
          </h2>
          <p className="vk-prose">
            villaKoi nasce da una domanda semplice: come si traduce la <strong>pazienza</strong> in
            un&rsquo;interfaccia? L&rsquo;allevamento delle carpe Koi è un esercizio di lentezza —
            anni di cura per un solo gesto di colore nell&rsquo;acqua. L&rsquo;obiettivo è stato
            portare quella quiete nel digitale: niente fretta, niente rumore.
          </p>
          <p className="vk-prose">
            Solo <strong>spazio negativo</strong>, respiro tipografico e movimento che asseconda lo
            scroll invece di contrastarlo. Ogni interazione è pensata per rilassare l&rsquo;occhio,
            non per reclamare attenzione — un giardino Zen che si rivela un gesto alla volta.
          </p>
        </section>

        {/* ════ DEEP-DIVE TECNICO ════ */}
        <section className="vk-wrap" data-reveal>
          <div className="vk-rule" />
          <span className="vk-section-eyebrow">02 — Ingegneria</span>
          <h2 className="vk-h2">
            Superficie quieta, <em>architettura</em> solida.
          </h2>

          <div className="vk-grid">
            <DeepDiveCard
              num="01"
              title="Frontend & Animazione"
              tags={['React', 'GSAP', 'ScrollTrigger']}
            >
              Il front-end è costruito in <strong>React</strong>, con <strong>GSAP</strong> e
              ScrollTrigger a orchestrare il movimento. Gli elementi escono dai propri margini in un
              parallax <strong>&ldquo;out-of-bounds&rdquo;</strong> controllato, mentre un blueprint
              tecnico si trasforma — morphing — nella superficie di uno stagno. Ogni animazione vive
              esclusivamente su <strong>transform</strong> e <strong>opacity</strong>: mai proprietà
              che innescano reflow, così l&rsquo;esperienza resta fluida a 60fps anche su hardware
              modesto, e collassa con grazia quando l&rsquo;utente richiede &ldquo;riduci
              movimento&rdquo;.
            </DeepDiveCard>

            <DeepDiveCard
              num="02"
              title="Architettura Backend"
              tags={['Python', 'FastAPI', 'Pydantic']}
            >
              Dietro la calma della superficie, una base robusta. Il back-end è scritto interamente
              in <strong>Python</strong> con <strong>FastAPI</strong>: endpoint asincroni,
              validazione tipizzata con Pydantic e gestione <strong>sicura</strong> delle richieste
              API e degli invii dei form. Un&rsquo;architettura scalabile e documentata in automatico
              (OpenAPI), pronta a reggere il traffico senza mai incrinare la quiete
              dell&rsquo;interfaccia.
            </DeepDiveCard>
          </div>

          {/* ════ CTA ════ */}
          <div className="vk-cta-row">
            {/* TODO: sostituire href="#" con gli URL reali quando disponibili */}
            <a className="vk-cta vk-cta-primary" href="https://villa-koi-site.vercel.app/" target="_blank" rel="noopener noreferrer">
              Visita il sito live
              <span className="vk-cta-icon"><ArrowUpRight /></span>
            </a>
            <a className="vk-cta vk-cta-ghost" href="https://github.com/sebamoxx/VillaKoiSite" target="_blank" rel="noopener noreferrer">
              Codice su GitHub
              <span className="vk-cta-icon"><ArrowUpRight /></span>
            </a>
          </div>
        </section>

        {/* ════ FOOTER ════ */}
        <footer className="vk-wrap">
          <div className="vk-foot" data-reveal>
            <span>villaKoi — 2026</span>
            <Link to="/" state={{ scrollToWorks: true }} className="vk-back">
              <ArrowLeft className="vk-back-arrow" />
              Torna ai progetti
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
