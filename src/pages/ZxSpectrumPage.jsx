import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Helmet } from 'react-helmet-async';

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
const C = {
  bgDeep:   '#020202',
  bg:       '#050302',
  accent:   '#4AF626',
  gold:     '#F4A261',
  text:     '#F0E6D3',
  muted:    'rgba(240,230,211,0.42)',
  rail:     'rgba(74, 246, 38, 0.15)',
};
const FONT = "'Outfit','Cabinet Grotesk','Geist',system-ui,sans-serif";
const MONO = "'JetBrains Mono','ui-monospace',monospace";

/* ═══════════════════════════════════════════════════════════════
   GLOBAL CSS INJECTED ONCE
═══════════════════════════════════════════════════════════════ */
const globalCSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Scrollbar CRT ── */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #020202; }
  ::-webkit-scrollbar-thumb { background: rgba(74,246,38,0.4); border-radius: 0; }

  /* ── Back Button ── */
  .zx-back-btn {
    font-family: ${MONO};
    color: #020202;
    background: #4AF626;
    padding: 0.55rem 1.2rem;
    text-decoration: none;
    font-size: 0.82rem;
    font-weight: 700;
    display: inline-block;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
    transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  }
  .zx-back-btn:hover {
    background: #020202;
    color: #4AF626;
    box-shadow: 0 0 18px rgba(74,246,38,0.55), inset 0 0 0 1px #4AF626;
  }

  /* ── Card con hover glow ── */
  .zx-card {
    padding: 2rem;
    border: 1px solid rgba(74,246,38,0.15);
    background: rgba(74,246,38,0.02);
    transition: border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  .zx-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(74,246,38,0.04) 0%, transparent 60%);
    opacity: 0;
    transition: opacity 0.4s ease;
  }
  .zx-card:hover {
    border-color: rgba(74,246,38,0.45);
    box-shadow: 0 0 24px rgba(74,246,38,0.12), inset 0 0 30px rgba(74,246,38,0.03);
    background: rgba(74,246,38,0.04);
  }
  .zx-card:hover::before { opacity: 1; }

  /* ── Media Frame ── */
  .zx-media-frame {
    border: 1px solid rgba(74,246,38,0.15);
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
    position: relative;
  }
  .zx-media-frame:hover {
    border-color: rgba(74,246,38,0.5);
    box-shadow: 0 0 30px rgba(74,246,38,0.15);
  }
  .zx-media-frame-accent {
    border: 1px solid #4AF626;
    position: relative;
    transition: box-shadow 0.3s ease;
  }
  .zx-media-frame-accent:hover {
    box-shadow: 0 0 30px rgba(74,246,38,0.35);
  }

  /* ── Badge di stato ── */
  .zx-badge {
    font-family: ${MONO};
    color: #4AF626;
    font-size: 0.78rem;
    border: 1px solid #4AF626;
    padding: 0.3rem 0.8rem;
    letter-spacing: 0.05em;
    transition: background 0.2s, box-shadow 0.2s;
    white-space: nowrap;
  }
  .zx-badge:hover {
    background: rgba(74,246,38,0.08);
    box-shadow: 0 0 10px rgba(74,246,38,0.3);
  }
  .zx-badge-dim { opacity: 0.45; }

  /* ── Terminale ── */
  .zx-terminal {
    background: #000;
    border: 1px dashed rgba(74,246,38,0.2);
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s ease;
  }
  .zx-terminal:hover {
    border-color: rgba(74,246,38,0.45);
    box-shadow: 0 0 40px rgba(74,246,38,0.06);
  }
  .zx-terminal-scanlines {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(0,0,0,0.22) 3px,
      rgba(0,0,0,0.22) 4px
    );
    z-index: 5;
  }
  .zx-terminal-vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.75) 100%);
    z-index: 6;
  }
  .zx-terminal-content {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 2rem;
  }
  .zx-terminal-topbar {
    position: absolute;
    top: 0; left: 0; right: 0;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid rgba(74,246,38,0.15);
    background: rgba(0,0,0,0.6);
    z-index: 11;
    font-family: ${MONO};
    font-size: 0.72rem;
    color: rgba(74,246,38,0.5);
  }
  .zx-terminal-topbar-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: rgba(74,246,38,0.3);
    box-shadow: 0 0 6px rgba(74,246,38,0.5);
    animation: dotBlink 2s ease-in-out infinite;
  }
  .zx-terminal-topbar-dot:nth-child(2) { animation-delay: 0.7s; }
  .zx-terminal-topbar-dot:nth-child(3) { animation-delay: 1.4s; }
  .zx-cursor-blink {
    display: inline-block;
    width: 10px; height: 1.2em;
    background: #4AF626;
    vertical-align: middle;
    margin-left: 4px;
    animation: cursorBlink 1s step-end infinite;
    box-shadow: 0 0 6px rgba(74,246,38,0.8);
  }
  .zx-progress-bar {
    width: 260px;
    height: 2px;
    background: rgba(74,246,38,0.15);
    position: relative;
    overflow: hidden;
    margin-top: 0.5rem;
  }
  .zx-progress-bar::after {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 60%;
    height: 100%;
    background: linear-gradient(90deg, transparent, #4AF626, transparent);
    animation: scanProgress 2.5s linear infinite;
  }

  /* ── Separatore ornamentale ── */
  .zx-hr {
    border: none;
    border-top: 1px solid rgba(74,246,38,0.15);
    position: relative;
  }
  .zx-hr::after {
    content: '◆';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    color: rgba(74,246,38,0.4);
    font-size: 0.75rem;
    background: #020202;
    padding: 0 1rem;
  }

  /* ── Sezione header row ── */
  .zx-section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  /* ── Label video overlay ── */
  .zx-rec-label {
    position: absolute;
    top: 1rem; left: 1rem;
    z-index: 10;
    background: rgba(0,0,0,0.85);
    padding: 0.4rem 0.8rem;
    border: 1px solid #4AF626;
    font-family: ${MONO};
    font-size: 0.7rem;
    color: #4AF626;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .zx-rec-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: #ff3b3b;
    box-shadow: 0 0 6px rgba(255,59,59,0.9);
    animation: dotBlink 1.2s ease-in-out infinite;
  }

  /* ── Stat list ── */
  .zx-stat-list {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .zx-stat-list li {
    color: rgba(240,230,211,0.5);
    line-height: 1.6;
    font-size: 0.92rem;
    padding-left: 1rem;
    border-left: 2px solid rgba(74,246,38,0.2);
    transition: border-color 0.2s, color 0.2s;
  }
  .zx-stat-list li:hover {
    border-left-color: rgba(74,246,38,0.7);
    color: rgba(240,230,211,0.75);
  }
  .zx-stat-list strong { color: #F0E6D3; }

  /* ══ LAYOUT RESPONSIVE ══ */

  /* Griglia before/after */
  .zx-before-after-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
  }

  /* Bento grid */
  .zx-bento-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
  }

  @media (max-width: 768px) {
    .zx-before-after-grid {
      grid-template-columns: 1fr;
    }
    .zx-bento-grid {
      grid-template-columns: 1fr;
    }
    .zx-section-header h2 {
      font-size: 1.8rem !important;
    }
  }

  /* ── Keyframes ── */
  @keyframes dotBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.2; }
  }
  @keyframes cursorBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  @keyframes scanProgress {
    0%   { left: -70%; }
    100% { left: 130%; }
  }
`;

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE
═══════════════════════════════════════════════════════════════ */
export default function ZxSpectrumPage() {
  const pageRef  = useRef(null);
  const heroRef  = useRef(null);
  const mediaRef = useRef(null);

  

  useEffect(() => {

    // Animazione Hero
    const ctx = gsap.context(() => {
      /* ── Animazione Hero ── */
      gsap.fromTo(heroRef.current.children,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1, stagger: 0.15, ease: 'expo.out' }
      );

      /* ── Animazione Media Gallery allo scroll ── */
      gsap.fromTo(mediaRef.current.children,
        { opacity: 0, y: 40 },
        {
          opacity: 1, y: 0, duration: 1, stagger: 0.2, ease: 'power3.out',
          scrollTrigger: { trigger: mediaRef.current, start: 'top 80%' }
        }
      );
    }, pageRef);

    /* ◄ Aggiunto: refresh di sicurezza dopo il mount, 
       in caso ScrollToTop (50ms / 400ms) non catturi 
       ancora questi elementi appena creati. */
    const refreshTimer = setTimeout(() => ScrollTrigger.refresh(true), 300);

    return () => {
      clearTimeout(refreshTimer);
      ctx.revert(); // ◄ uccide SOLO tween e trigger di questa pagina
    };
  }, []);
    

  return (
    <>
      {/* ── SEO DINAMICA PER QUESTA PAGINA ── */}
      <Helmet>
        <title>ZX Spectrum AI Engine | Seba Mollo</title>
        <meta 
          name="description" 
          content="Un algoritmo di ottimizzazione stocastica scritto in C nativo e compilato in WASM, progettato per forzare i limiti hardware degli anni '80." 
        />
        <meta property="og:title" content="ZX Spectrum AI Engine | Case Study" />
        <meta property="og:description" content="Simulated Annealing e WebAssembly applicati a un microprocessore del 1982. Guarda il case study completo." />
        {/* Se vuoi che la condivisione di questo link mostri la foto di Marilyn, usa il percorso specifico, altrimenti rimetti /images/anteprimaSito.jpg */}
        <meta property="og:image" content="/images/fotoMonroe.avif" /> 
      </Helmet>
      {/* ── Inject Global CSS ── */}
      <style>{globalCSS}</style>

      <main ref={pageRef} style={{
        background: C.bgDeep,
        color: C.text,
        minHeight: '100svh',
        padding: 'clamp(1.5rem, 4vw, 5rem)',
        overflowX: 'hidden',
      }}>

        {/* ══ HERO ══ */}
        <header
          ref={heroRef}
          style={{ maxWidth: '1200px', margin: '0 auto', paddingTop: 'clamp(2rem, 5vw, 4rem)' }}
        >
          {/* Back Button */}
          <div style={{ marginBottom: '3rem' }}>
            <Link to="/" state={{ scrollToWorks: true }} className="zx-back-btn">
              &lt; SYS.BACK_TO_HOME
            </Link>
          </div>

          {/* Tag categoria */}
          <p style={{
            fontFamily: MONO,
            color: C.accent,
            fontSize: 'clamp(0.7rem, 1.2vw, 0.82rem)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>
            [ Case Study // Ingegneria &amp; Algoritmi ]
          </p>

          {/* Titolo */}
          <h1 style={{
            fontFamily: FONT,
            fontSize: 'clamp(2.6rem, 8vw, 6rem)',
            fontWeight: 900,
            lineHeight: 1,
            margin: '0.8rem 0',
            letterSpacing: '-0.04em',
            textShadow: `0 0 60px rgba(74,246,38,0.08)`,
          }}>
            ZX Spectrum<br />
            <span style={{ color: C.accent }}>AI Engine</span>
          </h1>

          {/* Sottotitolo */}
          <p style={{
            fontSize: 'clamp(1rem, 1.8vw, 1.35rem)',
            color: C.muted,
            maxWidth: '720px',
            lineHeight: 1.7,
            marginTop: '1rem',
          }}>
            Un algoritmo di ottimizzazione stocastica scritto in C nativo, progettato per ricostruire immagini moderne forzandole attraverso i brutali limiti hardware di un microprocessore del 1982.
          </p>

          {/* Meta-info riga */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            marginTop: '2rem',
            fontFamily: MONO,
            fontSize: '0.75rem',
            color: C.muted,
            letterSpacing: '0.08em',
          }}>
            {[
              ['LINGUAGGIO', 'C / WASM'],
              ['ALGORITMO',  'Simulated Annealing'],
              ['ERRORE',     '10.18%'],
              ['STATUS',     'CONVERGENZA'],
            ].map(([k, v]) => (
              <div key={k}>
                <span style={{ color: C.accent, marginRight: '0.4rem' }}>{k}:</span>
                {v}
              </div>
            ))}
          </div>
        </header>

        {/* ── Separatore ── */}
        <div style={{ maxWidth: '1200px', margin: '4rem auto' }}>
          <hr className="zx-hr" />
        </div>

        {/* ══ VISUAL SHOWCASE ══ */}
        <section style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="zx-section-header">
            <h2 style={{ fontFamily: FONT, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', margin: 0 }}>
              Evoluzione Visiva
            </h2>
            <span className="zx-badge">STATUS: CONVERGENZA RAGGIUNTA</span>
          </div>

          <div ref={mediaRef} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* ── Video timelapse ── */}
            <div className="zx-media-frame" style={{
              background: '#000',
              padding: '0.5rem',
              maxWidth: '750px',
              margin: '0 auto',
              width: '100%',
            }}>
              <div className="zx-rec-label">
                <span className="zx-rec-dot" />
                EVOLUTION_TIMELAPSE.MOV
              </div>

              <video
                src="/images/monroeVideo.mp4"
                autoPlay loop muted playsInline
                style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  objectFit: 'cover',
                  filter: 'contrast(1.1)',
                  display: 'block',
                }}
              />

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
                padding: '0.6rem 0.5rem 0.2rem',
                fontFamily: MONO,
                fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)',
                color: C.muted,
              }}>
                <span>GENERAZIONI: 2.016.000</span>
                <span>TEMPO ELABORAZIONE C: 24m 32s</span>
              </div>
            </div>

            {/* ── Before / After ── */}
            <div className="zx-before-after-grid">

              {/* Originale */}
              <div className="zx-media-frame" style={{ background: '#000' }}>
                <div style={{
                  borderBottom: `1px solid ${C.rail}`,
                  padding: '0.5rem 1rem',
                  fontFamily: MONO,
                  fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)',
                  color: C.muted,
                  letterSpacing: '0.06em',
                }}>
                  SOURCE // INPUT_256x192.PNG
                </div>
                <img
                  src="/images/monroe_test.avif"
                  alt="Originale"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>

              {/* Output 8-bit */}
              <div className="zx-media-frame-accent" style={{ background: '#000' }}>
                <div style={{
                  borderBottom: `1px solid ${C.accent}`,
                  background: 'rgba(74,246,38,0.05)',
                  padding: '0.5rem 1rem',
                  fontFamily: MONO,
                  fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)',
                  color: C.accent,
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  letterSpacing: '0.06em',
                }}>
                  <span>OUTPUT // VRAM_6912B.SCR</span>
                  <span style={{ color: C.gold }}>ERR: 10.18%</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <img
                    src="/images/fotoMonroe.avif"
                    alt="8-bit Render"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                  {/* Scanline FX */}
                  <div aria-hidden style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)`,
                  }} />
                  {/* Vignette sull'output */}
                  <div aria-hidden style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)',
                  }} />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Separatore ── */}
        <div style={{ maxWidth: '1200px', margin: '5rem auto' }}>
          <hr className="zx-hr" />
        </div>

        {/* ══ BENTO GRID: STATISTICHE ══ */}
        <section style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="zx-section-header" style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontFamily: FONT, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', margin: 0 }}>
              Architettura del Sistema
            </h2>
          </div>

          <div className="zx-bento-grid">

            {/* Card 1 */}
            <div className="zx-card">
              <div style={{
                fontFamily: MONO,
                color: C.gold,
                marginBottom: '1.5rem',
                textTransform: 'uppercase',
                fontSize: '0.78rem',
                letterSpacing: '0.12em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}>
                <span style={{ color: C.accent }}>01 //</span> Il Limite Hardware
              </div>
              <ul className="zx-stat-list">
                <li><strong>VRAM Limitata:</strong> Solo 6912 byte per l'intero schermo.</li>
                <li><strong>Color Clash:</strong> Blocchi di 8×8 pixel con massimo 2 colori.</li>
                <li><strong>Palette Fissa:</strong> 15 colori disponibili, zero mezzitoni.</li>
              </ul>
            </div>

            {/* Card 2 */}
            <div className="zx-card">
              <div style={{
                fontFamily: MONO,
                color: C.gold,
                marginBottom: '1.5rem',
                textTransform: 'uppercase',
                fontSize: '0.78rem',
                letterSpacing: '0.12em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}>
                <span style={{ color: C.accent }}>02 //</span> Il Motore AI
              </div>
              <ul className="zx-stat-list">
                <li><strong>Simulated Annealing:</strong> Termodinamica per fuggire ai minimi locali.</li>
                <li><strong>Funzione di Costo:</strong> Distanza euclidea pesata sulla percezione umana (R=2, G=4, B=3).</li>
                <li><strong>WebAssembly:</strong> Porting del codice C nel browser via Emscripten.</li>
              </ul>
            </div>

          </div>
        </section>

        {/* ── Separatore ── */}
        <div style={{ maxWidth: '1200px', margin: '5rem auto' }}>
          <hr className="zx-hr" />
        </div>

        {/* ══ TERMINALE WASM ══ */}
        <section style={{ maxWidth: '1200px', margin: '0 auto 6rem' }}>
          <div className="zx-section-header">
            <h2 style={{ fontFamily: FONT, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', margin: 0 }}>
              Terminale di Generazione
            </h2>
            <span className="zx-badge zx-badge-dim">MODULO WASM OFFLINE</span>
          </div>

          <div
            className="zx-terminal"
            style={{ width: '100%', aspectRatio: '16/9' }}
          >
            {/* Top bar stile editor */}
            <div className="zx-terminal-topbar">
              <span className="zx-terminal-topbar-dot" />
              <span className="zx-terminal-topbar-dot" />
              <span className="zx-terminal-topbar-dot" />
              <span style={{ marginLeft: '0.5rem' }}>zx_engine.wasm — bash — 120×40</span>
            </div>

            {/* Scanlines + vignetta CRT */}
            <div className="zx-terminal-scanlines" aria-hidden />
            <div className="zx-terminal-vignette"  aria-hidden />

            {/* Contenuto */}
            <div className="zx-terminal-content" style={{ paddingTop: '4rem' }}>
              <div style={{ textAlign: 'left', width: '100%', maxWidth: '600px' }}>
                {/* Righe di log finte */}
                {[
                  { c: C.muted,   t: '$ ./zx_engine --input=source.png --output=vram.scr' },
                  { c: C.accent,  t: '> Caricamento modulo WASM...' },
                  { c: C.muted,   t: '> Inizializzazione Simulated Annealing...' },
                  { c: C.accent,  t: '> Temperatura: 1000.0 → cooling rate: 0.9995' },
                  { c: 'rgba(244,162,97,0.6)', t: '! WASM runtime non disponibile in questo ambiente.' },
                  { c: C.muted,   t: '> Tentativo di deploy in corso...' },
                ].map((line, i) => (
                  <div key={i} style={{
                    fontFamily: MONO,
                    fontSize: 'clamp(0.65rem, 1.4vw, 0.85rem)',
                    color: line.c,
                    lineHeight: 1.9,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {line.t}
                  </div>
                ))}

                {/* Prompt attivo con cursore */}
                <div style={{
                  fontFamily: MONO,
                  fontSize: 'clamp(0.65rem, 1.4vw, 0.85rem)',
                  color: C.accent,
                  lineHeight: 1.9,
                  marginTop: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  $ _<span className="zx-cursor-blink" />
                </div>

                {/* Progress bar scan */}
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{
                    fontFamily: MONO,
                    fontSize: '0.68rem',
                    color: 'rgba(74,246,38,0.4)',
                    marginBottom: '0.4rem',
                    letterSpacing: '0.1em',
                  }}>
                    MODULO IN FASE DI DEPLOY
                  </div>
                  <div className="zx-progress-bar" />
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
    </>
  );
}