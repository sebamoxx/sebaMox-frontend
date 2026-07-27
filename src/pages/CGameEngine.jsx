import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import SEO from '../components/SEO';
import { SITE } from '../seo.config';
import { useTransitionNavigate } from '../components/TransitionController';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/* ════════════════════════════════════════════════════════════════════
   FORGE ENGINE — CASE STUDY · "DEV CONSOLE / TELEMETRY HUD"
   ────────────────────────────────────────────────────────────────────
   Concept   : la pagina racconta un game engine 2D scritto in C puro
               (unica dipendenza: Raylib) parlando la sua stessa lingua.
               Telemetria monospace, moduli compartimentati da hairline,
               la TILEMAP VERA del livello 1 renderizzata come minimappa,
               log di ingegneria in un terminale. Token void/bone/amber
               ereditati da WorksArchive + UN accento verde terminale
               (#4AF626) riservato al solo readout RUNTIME.

   Contenuto : ogni dato tecnico proviene dal sorgente main.c —
               costanti, struct, algoritmi, matrice del livello. Ciò che
               NON è verificabile nel codice è marcato [ DA COMPLETARE ]
               come elemento del design system: mai una feature inventata.

   ────────────────────────────────────────────────────────────────────
   ROBUSTEZZA CROSS-BROWSER (perché ogni scelta è quella che è)
   ────────────────────────────────────────────────────────────────────
   · CSS INTERAMENTE SCOPED sotto .ce-root. Nessun reset globale (`*`),
     nessuna regola su <html>: montando questa pagina NON si alterano
     gli stili del resto del sito, e smontandola non resta nulla.
   · UNITÀ VIEWPORT: `100vh` dichiarato PRIMA di `100svh`. Safari < 15.4
     e Firefox < 101 ignorano svh e usano il fallback; i browser moderni
     sovrascrivono. Mai `h-screen` puro → niente jump della barra su iOS.
   · aspect-ratio: fallback con padding-top in @supports not (…) per
     Safari 14 e WebView Android datate. Lo slot media riserva SEMPRE
     lo spazio → zero Cumulative Layout Shift, su qualunque browser.
   · -webkit-text-stroke: usato solo dentro @supports. Senza il guard,
     un browser che non lo implementa renderizza `color: transparent`
     e il titolo diventa INVISIBILE. Con il guard degrada a testo pieno.
   · backdrop-filter: applicato solo alle isole fisse della nav e solo
     dentro @supports; il fallback è un fondo solido. Mai blur su
     contenuto che scorre (repaint continui = frame drop su mobile).
   · env(safe-area-inset-*): padding dichiarato due volte (base + max())
     così i browser senza env() tengono il valore base invece di
     invalidare la regola. Niente testo sotto il notch in landscape.
   · :hover confinato in @media (hover: hover) and (pointer: fine).
     Su touch gli stati hover "si incollano" dopo il tap: qui non
     esistono proprio. In compenso ogni interattivo ha :focus-visible
     e target ≥ 44px.
   · overflow-x: clip (non hidden) dentro @supports: `clip` NON crea un
     contenitore di scroll, quindi non interferisce con Lenis né con
     position: fixed. Tutte le griglie usano minmax(0, 1fr) e i testi
     overflow-wrap: anywhere → l'overflow orizzontale è impossibile
     per costruzione, non per rattoppo.

   ────────────────────────────────────────────────────────────────────
   ANTI-BUG / ANTI-CRASH (fallimenti previsti, non sperati)
   ────────────────────────────────────────────────────────────────────
   · ANTI-FOUC: gli stati iniziali nascosti si attivano SOLO quando il
     JS aggiunge la classe `is-armed`, in useLayoutEffect (prima del
     paint). Se il bundle non carica, se GSAP esplode, se l'utente ha
     JS disabilitato → la pagina resta completamente visibile e
     leggibile. Nessun contenuto può restare invisibile per sempre.
   · Rete di sicurezza a 2.5s: qualunque `.ce-reveal` non ancora
     rivelato (ScrollTrigger mis-measured, refresh saltato) viene
     forzato a visibile. Il contenuto ha SEMPRE la precedenza sull'FX.
   · Nessuna setState dopo unmount: flag `alive` su tutte le Promise di
     video.play() e sui listener asincroni.
   · SITE letto con optional chaining + fallback: se seo.config.js
     cambia forma, la pagina non va in schermata bianca.
   · useTransitionNavigate difeso: se l'hook restituisce qualcosa di
     non chiamabile, il CTA resta un <a> con navigazione nativa.
   · ctx.revert() + disconnect di OGNI IntersectionObserver + rimozione
     del ticker + clearTimeout allo smontaggio: navigando avanti e
     indietro non restano trigger, observer o RAF zombie.
   · document.fonts.ready → ScrollTrigger.refresh(): i font custom
     cambiano le metriche del testo DOPO il primo layout; senza questo
     i trigger si posizionano su misure vecchie.

   ────────────────────────────────────────────────────────────────────
   PERFORMANCE (budget, non buone intenzioni)
   ────────────────────────────────────────────────────────────────────
   · Si animano ESCLUSIVAMENTE transform e opacity. Nessun top/left/
     width/height/filter animato: zero reflow, tutto sul compositor.
   · ScrollTrigger.batch invece di N trigger indipendenti: un solo
     osservatore raggruppa i reveal e li anima in stagger.
   · Marquee e minimappa: animation-play-state governato da
     IntersectionObserver → fuori viewport la GPU non lavora.
   · FPS counter: scrive textContent su ref, mai setState (zero
     re-render di React), e il ticker viene fisicamente sganciato
     quando il readout esce dal viewport.
   · Spotlight del cursore: un solo listener pointermove passivo,
     coalescato in rAF, che scrive due CSS custom properties. Attivo
     solo su puntatore fine. Su touch non viene nemmeno registrato.
   · prefers-reduced-motion: rispettato alla radice — nessun tween,
     nessun ticker, nessun observer di motion viene creato. Non è una
     versione "degradata": è la stessa pagina, ferma.
════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — identici a WorksArchive (void / bone / amber)
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
const MONO = "'JetBrains Mono','IBM Plex Mono','ui-monospace','SFMono-Regular',Menlo,monospace";
const SANS = "'Outfit','Cabinet Grotesk','Geist',system-ui,sans-serif";
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'; // curva firma del sito
const TERM = '#4AF626'; // accento verde terminale — SOLO per il readout RUNTIME

/* ═══════════════════════════════════════════════════════════════
   CONVENZIONE ASSET — public/projects/c-game-engine/
   ───────────────────────────────────────────────────────────────
   I media non esistono ancora. Quando saranno pronti basterà
   copiarli nella cartella con ESATTAMENTE questi nomi: nessuna
   modifica al codice, gli slot si accendono da soli al primo
   onLoad. Finché mancano, ogni slot mostra lo stato "pending" e
   tiene lo spazio riservato (nessun salto di layout all'arrivo).

   TUTTI i media rispettano il rapporto NATIVO della finestra di gioco
   (640 × 428 → 1280 × 856, upscale 2× nearest-neighbor per non
   impastare i pixel). Gli slot usano lo stesso rapporto, quindi
   object-fit: cover non croppa NULLA.

   cover.jpg              → card archivio /works — 1600×1000 (16:10)
   og-cover.jpg           → anteprima social (seo.config.js) — 1200×630
   gameplay-01.mp4        → clip hero — 1280×856, H.264 main, muto,
                            faststart, ~5 MB
   poster-gameplay-01.jpg → poster della clip hero — 1280×856
   gameplay-02.mp4        → clip boss / livello 3 — 1280×856, ~6 MB
   poster-gameplay-02.jpg → poster della clip boss — 1280×856
   screenshot-01.webp     → livello 1 — 1280×856
   screenshot-02.webp     → livello 2 — 1280×856
   screenshot-03.webp     → negozio / HUD — 1280×856 (ANCORA MANCANTE:
                            lo slot resta in stato pending finché non
                            registri una clip che mostra il negozio)

   NOTA H.264: usare profile "baseline" o "main" (non "high 4:4:4")
   e faststart (moov atom all'inizio) — è ciò che rende la clip
   riproducibile su iOS Safari senza download completo.
═══════════════════════════════════════════════════════════════ */
const ASSET_DIR = '/projects/c-game-engine';

/* ═══════════════════════════════════════════════════════════════
   TILEMAP REALE — main.c · mappe[0], colonne 0-39 di 100
   ───────────────────────────────────────────────────────────────
   Questi sono i dati veri del primo livello, trascritti dalla
   matrice `int mappe[2][RIGHE][COLONNE]` del sorgente. La legenda
   è quella dichiarata in testa a main.c.
     0 = aria   1 = muro    2 = cassa    3 = botola
     4 = cuore  5 = porta   6 = moneta   7 = torretta
═══════════════════════════════════════════════════════════════ */
const TILEMAP = [
  '1111111111111131111111111111311111111111',
  '1000000000000060000000000000004600000000',
  '1000000000000011111110000000011110006040',
  '1000110000000000000000000000000100001111',
  '1000000000060600002000030000000030000000',
  '1000010200031100000004600000000001111111',
  '1000000000060000001111111131320000006000',
  '1000011111131130000000000000000000000111',
  '1000000000060000040000600060600060000000',
  '1111111111131131111111111131311111111111',
];

const TILE_LEGEND = [
  { id: '1', k: 'MURO',     d: 'blocco fisico' },
  { id: '2', k: 'CASSA',    d: 'distruttibile · +10' },
  { id: '3', k: 'BOTOLA',   d: 'non fisica' },
  { id: '4', k: 'CUORE',    d: '+1 HP' },
  { id: '6', k: 'MONETA',   d: '+10 monete' },
  { id: '5', k: 'PORTA',    d: 'uscita livello' },
];

/* Telemetria del marquee — costanti reali dichiarate in main.c */
const TICKER = [
  'GRAVITÀ 1800 PX/S²',
  'FORZA SALTO −600',
  'TILE 40 PX',
  'GRIGLIA 10 × 100',
  'TARGET 60 FPS',
  'PROIETTILE 370 PX/S',
  'POOL COLPI 10',
  'POOL PARTICELLE 200',
  'INVULN 1.0 S',
  'COOLDOWN TORRETTA 1.5 S',
  'PORTATA TORRETTA 300 PX',
  'CAMERA LERP 0.1',
];

/* ═══════════════════════════════════════════════════════════════
   CSS — interamente scoped sotto .ce-root
═══════════════════════════════════════════════════════════════ */
const CSS = `
  .ce-root {
    --ce-pad: clamp(1.25rem, 5vw, 4rem);
    --ce-maxw: 1400px;
    --mx: 50%;
    --my: 50%;
    background: ${T.void};
    color: ${T.bone};
    font-family: ${SANS};
    min-height: 100vh;
    min-height: 100svh;
    position: relative;
    isolation: isolate;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  /* clip (non hidden): non crea un contenitore di scroll → nessun
     conflitto con Lenis, position:fixed e sticky restano validi. */
  @supports (overflow: clip) {
    .ce-root { overflow-x: clip; }
  }

  .ce-root *, .ce-root *::before, .ce-root *::after { box-sizing: border-box; }
  .ce-root h1, .ce-root h2, .ce-root h3, .ce-root p,
  .ce-root figure, .ce-root ul, .ce-root li, .ce-root dl,
  .ce-root dt, .ce-root dd { margin: 0; padding: 0; }
  .ce-root ul { list-style: none; }
  .ce-root ::selection { background: ${T.amberDim}; color: ${T.void}; }
  .ce-root p, .ce-root li, .ce-root dd { overflow-wrap: anywhere; }

  /* Accessibilità: ogni interattivo ha un focus visibile e keyboard-only */
  .ce-root a:focus-visible,
  .ce-root button:focus-visible {
    outline: 1px solid ${T.amber};
    outline-offset: 3px;
    border-radius: 6px;
  }
  .ce-sr {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  /* ── GRAIN (fisso, pointer-events none, zero repaint su scroll) ── */
  .ce-grain {
    position: fixed;
    top: 0; right: 0; bottom: 0; left: 0;
    z-index: 3;
    pointer-events: none;
    opacity: 0.05;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 140px 140px;
  }

  /* ── NAV A ISOLE (pillole flottanti staccate dal bordo) ── */
  .ce-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 8;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    pointer-events: none;
    padding: clamp(0.9rem, 2.2vw, 1.5rem) var(--ce-pad);
    padding-left: max(var(--ce-pad), env(safe-area-inset-left));
    padding-right: max(var(--ce-pad), env(safe-area-inset-right));
    padding-top: max(clamp(0.9rem, 2.2vw, 1.5rem), env(safe-area-inset-top));
    max-width: var(--ce-maxw);
    margin: 0 auto;
  }
  .ce-island {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    min-height: 44px;
    padding: 0.55rem 1.1rem;
    border-radius: 999px;
    border: 1px solid ${T.hairline};
    background: rgba(10,10,10,0.82);
    font-family: ${MONO};
    font-size: 0.66rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${T.boneDim};
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.45s ${EASE}, border-color 0.45s ${EASE}, background 0.45s ${EASE};
  }
  /* Blur SOLO su elemento fisso e di area minima, e solo se supportato */
  @supports ((-webkit-backdrop-filter: blur(12px)) or (backdrop-filter: blur(12px))) {
    .ce-island {
      background: rgba(10,10,10,0.55);
      -webkit-backdrop-filter: blur(12px) saturate(140%);
      backdrop-filter: blur(12px) saturate(140%);
    }
  }
  .ce-island svg { flex-shrink: 0; }
  .ce-island-arrow { transition: transform 0.45s ${EASE}; }
  .ce-island-tag { color: ${T.amber}; white-space: nowrap; }
  .ce-island-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: ${T.amber};
    flex-shrink: 0;
  }

  /* ── RAIL DI PROGRESSO (HUD laterale, solo desktop largo) ── */
  .ce-rail {
    position: fixed;
    top: 50%;
    right: clamp(0.9rem, 1.6vw, 1.6rem);
    transform: translateY(-50%);
    z-index: 7;
    display: none;
    flex-direction: column;
    gap: 0.85rem;
    pointer-events: none;
  }
  .ce-rail-item {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.6rem;
    font-family: ${MONO};
    font-size: 0.52rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: ${T.boneGhost};
    transition: color 0.55s ${EASE};
  }
  .ce-rail-item span { opacity: 0; transform: translateX(6px); transition: opacity 0.55s ${EASE}, transform 0.55s ${EASE}; }
  .ce-rail-tick {
    display: block;
    width: 16px; height: 1px;
    background: ${T.boneGhost};
    transform-origin: right center;
    transition: transform 0.55s ${EASE}, background 0.55s ${EASE};
  }
  .ce-rail-item.is-active { color: ${T.amber}; }
  .ce-rail-item.is-active span { opacity: 1; transform: translateX(0); }
  .ce-rail-item.is-active .ce-rail-tick { background: ${T.amber}; transform: scaleX(1.8); }

  /* ── LAYOUT DI BASE ── */
  .ce-wrap {
    max-width: var(--ce-maxw);
    margin: 0 auto;
    padding-left: var(--ce-pad);
    padding-right: var(--ce-pad);
    padding-left: max(var(--ce-pad), env(safe-area-inset-left));
    padding-right: max(var(--ce-pad), env(safe-area-inset-right));
  }
  .ce-section { padding-top: clamp(4.5rem, 9vw, 8.5rem); padding-bottom: clamp(4.5rem, 9vw, 8.5rem); }

  /* ── HERO ── */
  .ce-hero {
    min-height: 100vh;
    min-height: 100svh;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: end;
    gap: clamp(1.5rem, 3vw, 2.4rem);
    padding-top: clamp(6.5rem, 13vw, 10rem);
    padding-bottom: clamp(2.5rem, 5vw, 4rem);
  }
  .ce-eyebrow-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.85rem;
    font-family: ${MONO};
    font-size: 0.6rem;
    letter-spacing: 0.26em;
    text-transform: uppercase;
  }
  .ce-eyebrow-sys { color: ${T.amber}; }
  .ce-eyebrow-dim { color: ${T.boneGhost}; }

  .ce-clip-wrap { display: block; overflow: hidden; }
  .ce-clip-inner { display: block; }

  .ce-title {
    font-family: ${SANS};
    font-weight: 900;
    font-size: clamp(3.2rem, 13.5vw, 11rem);
    line-height: 0.86;
    letter-spacing: -0.05em;
    text-transform: uppercase;
    color: ${T.bone};
  }
  .ce-title-line { display: flex; overflow: hidden; }
  .ce-char { display: block; }
  /* Senza @supports il testo diventerebbe invisibile sui browser
     che non implementano text-stroke: qui degrada a outline "finto". */
  .ce-title-ghost { color: ${T.boneGhost}; }
  @supports (-webkit-text-stroke: 1px #000) {
    .ce-title-ghost {
      color: transparent;
      -webkit-text-stroke: 1px rgba(232,227,216,0.34);
    }
  }

  .ce-lede {
    font-family: ${SANS};
    font-size: clamp(0.98rem, 1.6vw, 1.2rem);
    line-height: 1.65;
    color: ${T.boneDim};
    max-width: 58ch;
  }
  .ce-lede strong { color: ${T.bone}; font-weight: 600; }

  .ce-chip-row { display: flex; flex-wrap: wrap; gap: 0.45rem; }
  .ce-chip {
    font-family: ${MONO};
    font-size: 0.55rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${T.boneDim};
    border: 1px solid ${T.hairline};
    border-radius: 999px;
    padding: 0.36rem 0.8rem;
    transition: color 0.4s ${EASE}, border-color 0.4s ${EASE};
  }

  .ce-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 1.25rem;
  }
  .ce-meta-cols { display: flex; flex-wrap: wrap; min-width: 0; row-gap: 1.1rem; }
  .ce-meta-col {
    position: relative;
    padding: 0.2rem clamp(1rem, 2.6vw, 2.2rem);
    border-left: 1px solid ${T.hairline};
  }
  .ce-meta-col:first-child { border-left: none; padding-left: 0; }
  .ce-meta-k {
    font-family: ${MONO};
    font-size: 0.56rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: ${T.boneGhost};
    margin-bottom: 0.35rem;
  }
  .ce-meta-v { font-family: ${SANS}; font-size: 0.95rem; font-weight: 600; color: ${T.bone}; }

  .ce-runtime {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-family: ${MONO};
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    color: ${T.boneDim};
    white-space: nowrap;
  }
  .ce-runtime-dot { width: 6px; height: 6px; border-radius: 50%; background: ${TERM}; flex-shrink: 0; }
  .ce-runtime-val { color: ${TERM}; }

  /* ── TESTATE DI SEZIONE ── */
  .ce-sec-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.75rem;
    border-bottom: 1px solid ${T.hairline};
    padding-bottom: 1.2rem;
    margin-bottom: clamp(2.25rem, 5vw, 3.75rem);
  }
  .ce-sec-label {
    font-family: ${MONO};
    font-size: 0.64rem;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: ${T.amber};
  }
  .ce-sec-meta { font-family: ${MONO}; font-size: 0.58rem; letter-spacing: 0.12em; color: ${T.boneGhost}; }

  .ce-h2 {
    font-family: ${SANS};
    font-weight: 800;
    font-size: clamp(2.1rem, 5.4vw, 4.4rem);
    line-height: 1.03;
    letter-spacing: -0.04em;
    color: ${T.bone};
    max-width: 22ch;
  }
  .ce-h2 em { font-style: normal; color: ${T.amber}; }

  .ce-overview-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: clamp(2.5rem, 6vw, 6rem);
    align-items: start;
  }
  .ce-prose { border-left: 1px solid ${T.hairline}; padding-left: clamp(1.75rem, 4vw, 3.5rem); }
  .ce-prose p {
    font-family: ${SANS};
    font-size: clamp(0.95rem, 1.2vw, 1.05rem);
    line-height: 1.8;
    color: ${T.boneDim};
    max-width: 54ch;
    margin-bottom: 1.4rem;
  }
  .ce-prose p:last-child { margin-bottom: 0; }
  .ce-prose strong { color: ${T.bone}; font-weight: 600; }
  .ce-prose code {
    font-family: ${MONO};
    font-size: 0.86em;
    color: ${T.amber};
    background: ${T.amberGhost};
    padding: 0.1em 0.4em;
    border-radius: 4px;
  }

  /* ── PLACEHOLDER [ DA COMPLETARE ] ── */
  .ce-pending {
    display: block;
    margin-top: 1rem;
    padding: 0.7rem 0.9rem;
    border: 1px dashed ${T.amberDim};
    border-radius: 0.6rem;
    background: ${T.amberGhost};
  }
  .ce-pending-tag {
    display: inline-block;
    font-family: ${MONO};
    font-size: 0.5rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${T.amber};
    margin-bottom: 0.35rem;
  }
  .ce-pending-body { display: block; font-family: ${MONO}; font-size: 0.68rem; line-height: 1.65; color: ${T.boneDim}; }

  /* ── BENTO ASIMMETRICO DEI MODULI ── */
  .ce-mod-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: clamp(0.8rem, 1.8vw, 1.3rem);
    position: relative;
  }
  .ce-mod-shell {
    grid-column: span 6;
    position: relative;
    /* z-index 1: lo spotlight (::before del grid) resta DIETRO le card e
       traspare attraverso i loro fondi semitrasparenti — luce fisica,
       non un velo ambra sopra il testo. */
    z-index: 1;
    padding: 0.45rem;
    border-radius: 1.3rem;
    background: rgba(232,227,216,0.03);
    border: 1px solid ${T.hairline};
    transition: border-color 0.7s ${EASE}, background 0.7s ${EASE};
  }
  .ce-mod-core {
    position: relative;
    height: 100%;
    border-radius: calc(1.3rem - 0.45rem);
    background: rgba(8,8,8,0.85);
    border: 1px solid rgba(232,227,216,0.06);
    box-shadow: inset 0 1px 1px rgba(232,227,216,0.07);
    padding: clamp(1.15rem, 2.4vw, 1.8rem);
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    overflow: hidden;
  }
  .ce-mod-head { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; }
  .ce-mod-id { font-family: ${MONO}; font-size: 0.54rem; letter-spacing: 0.28em; color: ${T.amber}; }
  .ce-mod-bus { flex: 1; height: 1px; background: ${T.hairline}; }
  .ce-mod-name {
    font-family: ${SANS};
    font-weight: 800;
    font-size: clamp(1.02rem, 1.8vw, 1.3rem);
    letter-spacing: -0.02em;
    text-transform: uppercase;
    color: ${T.bone};
  }
  .ce-mod-desc { font-family: ${SANS}; font-size: 0.88rem; line-height: 1.7; color: ${T.boneDim}; }
  .ce-mod-facts { display: flex; flex-direction: column; gap: 0.4rem; margin-top: auto; padding-top: 0.4rem; }
  .ce-mod-fact {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    font-family: ${MONO};
    font-size: 0.62rem;
    line-height: 1.5;
    color: ${T.boneDim};
    border-top: 1px solid ${T.hairline};
    padding-top: 0.4rem;
  }
  .ce-mod-fact b { color: ${T.amber}; font-weight: 400; flex-shrink: 0; }

  /* ── MINIMAPPA (tilemap reale) ── */
  .ce-map-shell {
    padding: 0.45rem;
    border-radius: 1.3rem;
    background: rgba(232,227,216,0.03);
    border: 1px solid ${T.hairline};
  }
  .ce-map-core {
    position: relative;
    border-radius: calc(1.3rem - 0.45rem);
    background: #070707;
    border: 1px solid rgba(232,227,216,0.06);
    box-shadow: inset 0 1px 1px rgba(232,227,216,0.07);
    padding: clamp(0.9rem, 2.2vw, 1.6rem);
    overflow: hidden;
  }
  .ce-map-grid {
    display: grid;
    grid-template-columns: repeat(40, minmax(0, 1fr));
    gap: 1px;
    position: relative;
    z-index: 1;
  }
  .ce-cell { aspect-ratio: 1 / 1; border-radius: 1px; }
  @supports not (aspect-ratio: 1 / 1) {
    .ce-cell { height: 0; padding-bottom: 100%; }
  }
  .ce-cell-0 { background: rgba(232,227,216,0.02); }
  .ce-cell-1 { background: rgba(232,227,216,0.22); }
  .ce-cell-2 { background: ${T.amberDim}; }
  .ce-cell-3 { background: rgba(232,227,216,0.07); }
  .ce-cell-4 { background: ${T.bone}; border-radius: 50%; }
  .ce-cell-5 { background: ${T.bone}; }
  .ce-cell-6 { background: ${T.amber}; border-radius: 50%; }
  .ce-cell-7 { background: ${T.amberDim}; border: 1px solid ${T.amber}; }
  /* Sweep: un solo elemento animato in transform, sotto la griglia */
  .ce-map-sweep {
    position: absolute;
    top: 0; bottom: 0; left: 0;
    width: 28%;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, ${T.amberGhost} 45%, transparent);
    transform: translate3d(-40%, 0, 0);
  }
  .ce-map-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.7rem 1.4rem;
    margin-top: 1.1rem;
    padding-top: 1rem;
    border-top: 1px solid ${T.hairline};
  }
  .ce-leg { display: inline-flex; align-items: center; gap: 0.5rem; }
  .ce-leg-sw { width: 10px; height: 10px; flex-shrink: 0; }
  .ce-leg-t { font-family: ${MONO}; font-size: 0.56rem; letter-spacing: 0.14em; text-transform: uppercase; color: ${T.boneDim}; }
  .ce-leg-t b { color: ${T.bone}; font-weight: 500; }

  /* ── MARQUEE TELEMETRIA ── */
  .ce-tick {
    position: relative;
    overflow: hidden;
    border-top: 1px solid ${T.hairline};
    border-bottom: 1px solid ${T.hairline};
    padding: 0.85rem 0;
  }
  .ce-tick-track {
    display: flex;
    align-items: center;
    gap: 2.4rem;
    width: max-content;
    transform: translate3d(0, 0, 0);
  }
  .ce-tick-item {
    display: inline-flex;
    align-items: center;
    gap: 0.7rem;
    font-family: ${MONO};
    font-size: 0.6rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: ${T.boneDim};
    white-space: nowrap;
  }
  .ce-tick-item::before { content: '///'; color: ${T.amberDim}; }

  /* ── CAMPAGNA (3 livelli) ── */
  .ce-lv-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(0.8rem, 1.8vw, 1.3rem); }
  .ce-lv-shell {
    padding: 0.45rem;
    border-radius: 1.3rem;
    background: rgba(232,227,216,0.03);
    border: 1px solid ${T.hairline};
    transition: border-color 0.7s ${EASE}, background 0.7s ${EASE};
  }
  .ce-lv-shell.is-boss { border-color: ${T.amberDim}; background: ${T.amberGhost}; }
  .ce-lv-core {
    height: 100%;
    border-radius: calc(1.3rem - 0.45rem);
    background: rgba(8,8,8,0.85);
    border: 1px solid rgba(232,227,216,0.06);
    box-shadow: inset 0 1px 1px rgba(232,227,216,0.07);
    padding: clamp(1.15rem, 2.4vw, 1.7rem);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .ce-lv-top { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
  .ce-lv-id { font-family: ${MONO}; font-size: 0.54rem; letter-spacing: 0.26em; color: ${T.amber}; }
  .ce-lv-badge {
    font-family: ${MONO};
    font-size: 0.5rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: ${T.void};
    background: ${T.amber};
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
  }
  .ce-lv-name {
    font-family: ${SANS};
    font-weight: 800;
    font-size: clamp(1.15rem, 2.2vw, 1.6rem);
    letter-spacing: -0.03em;
    text-transform: uppercase;
    color: ${T.bone};
  }
  .ce-lv-desc { font-family: ${SANS}; font-size: 0.88rem; line-height: 1.7; color: ${T.boneDim}; }

  /* ── MEDIA SLOT ── */
  .ce-slot-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; margin-bottom: 0.75rem; }
  .ce-slot-label { font-family: ${MONO}; font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase; color: ${T.amber}; }
  .ce-slot-meta { font-family: ${MONO}; font-size: 0.54rem; letter-spacing: 0.12em; color: ${T.boneGhost}; white-space: nowrap; }
  .ce-slot-shell { padding: 0.45rem; border-radius: 1.3rem; background: rgba(232,227,216,0.03); border: 1px solid ${T.hairline}; }
  .ce-slot-core {
    position: relative;
    border-radius: calc(1.3rem - 0.45rem);
    overflow: hidden;
    background: #0a0a0a;
    border: 1px solid rgba(232,227,216,0.06);
    box-shadow: inset 0 1px 1px rgba(232,227,216,0.07);
  }
  /* Fallback per browser senza aspect-ratio: lo spazio resta riservato */
  @supports not (aspect-ratio: 640 / 428) {
    /* 428 / 640 = 66.875% — stesso rapporto della finestra di gioco,
       così anche i browser senza aspect-ratio riservano lo spazio esatto
       e il video non viene mai croppato da object-fit: cover. */
    .ce-slot-core { height: 0; padding-bottom: 66.875%; }
    .ce-slot-core.is-portrait { padding-bottom: 125%; }
  }
  .ce-slot-media {
    position: absolute;
    top: 0; right: 0; bottom: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.9s ${EASE};
  }
  .ce-slot-media.is-ready { opacity: 1; }
  .ce-slot-pending {
    position: absolute;
    top: 0; right: 0; bottom: 0; left: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    text-align: center;
    padding: 1rem;
    background:
      radial-gradient(ellipse at 50% 62%, ${T.amberGhost}, transparent 68%),
      repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(232,227,216,0.025) 3px, rgba(232,227,216,0.025) 4px);
    transition: opacity 0.9s ${EASE};
  }
  .ce-slot-pending.is-hidden { opacity: 0; }
  .ce-slot-pending-label { font-family: ${MONO}; font-size: clamp(0.58rem, 1.4vw, 0.7rem); letter-spacing: 0.26em; text-transform: uppercase; color: ${T.amber}; }
  .ce-slot-pending-sub { font-family: ${MONO}; font-size: 0.54rem; letter-spacing: 0.16em; text-transform: uppercase; color: ${T.boneDim}; }
  .ce-cursor { display: inline-block; width: 0.55em; height: 1em; margin-left: 0.25em; vertical-align: text-bottom; background: ${T.amberDim}; }
  .ce-bracket { position: absolute; width: 18px; height: 18px; pointer-events: none; }
  .ce-bracket-tl { top: 0.9rem; left: 0.9rem; border-top: 1px solid ${T.amberDim}; border-left: 1px solid ${T.amberDim}; }
  .ce-bracket-tr { top: 0.9rem; right: 0.9rem; border-top: 1px solid ${T.amberDim}; border-right: 1px solid ${T.amberDim}; }
  .ce-bracket-bl { bottom: 0.9rem; left: 0.9rem; border-bottom: 1px solid ${T.amberDim}; border-left: 1px solid ${T.amberDim}; }
  .ce-bracket-br { bottom: 0.9rem; right: 0.9rem; border-bottom: 1px solid ${T.amberDim}; border-right: 1px solid ${T.amberDim}; }

  .ce-play {
    position: absolute;
    top: 0; right: 0; bottom: 0; left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(5,5,5,0.35);
    border: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ce-play-orb {
    width: 64px; height: 64px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(232,227,216,0.06);
    border: 1px solid ${T.amberDim};
    transition: transform 0.45s ${EASE}, background 0.45s ${EASE};
  }
  .ce-play-orb svg { display: block; margin-left: 3px; }

  .ce-gal-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(1.1rem, 2.4vw, 1.9rem); }
  .ce-gal-wide { grid-column: 1 / -1; }

  /* ── SPEC SHEET ── */
  .ce-spec-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    background: ${T.hairline};
    border: 1px solid ${T.hairline};
    border-radius: 0.9rem;
    overflow: hidden;
  }
  .ce-spec-cell { background: #070707; padding: clamp(0.9rem, 2vw, 1.3rem) clamp(0.85rem, 2vw, 1.2rem); transition: background 0.45s ${EASE}; }
  .ce-spec-k { font-family: ${MONO}; font-size: 0.52rem; letter-spacing: 0.2em; text-transform: uppercase; color: ${T.boneGhost}; margin-bottom: 0.4rem; }
  .ce-spec-v { font-family: ${MONO}; font-size: 0.78rem; letter-spacing: 0.04em; color: ${T.bone}; line-height: 1.5; }
  .ce-spec-cell.is-tbd .ce-spec-v { color: ${T.amberDim}; }

  /* ── DESIGN LOG (terminale) ── */
  .ce-log-shell { padding: 0.45rem; border-radius: 1.3rem; background: rgba(232,227,216,0.03); border: 1px solid ${T.hairline}; }
  .ce-log-core {
    border-radius: calc(1.3rem - 0.45rem);
    background: #000;
    border: 1px solid rgba(232,227,216,0.06);
    box-shadow: inset 0 1px 1px rgba(232,227,216,0.07);
    overflow: hidden;
  }
  .ce-log-bar { display: flex; align-items: center; gap: 0.7rem; padding: 0.7rem 1.1rem; border-bottom: 1px solid ${T.hairline}; background: rgba(232,227,216,0.02); }
  .ce-log-dots { display: flex; gap: 0.4rem; }
  .ce-log-dot { width: 10px; height: 10px; border-radius: 50%; }
  .ce-dot-r { background: #FF5F56; }
  .ce-dot-y { background: #FFBD2E; }
  .ce-dot-g { background: #27C93F; }
  .ce-log-file { margin-left: auto; font-family: ${MONO}; font-size: 0.58rem; letter-spacing: 0.06em; color: ${T.boneDim}; }
  .ce-log-body { padding: clamp(1.2rem, 3vw, 2rem); display: flex; flex-direction: column; gap: 1.5rem; }
  .ce-log-entry-head { font-family: ${MONO}; font-size: 0.7rem; letter-spacing: 0.12em; color: ${T.bone}; }
  .ce-log-prompt { color: ${T.amber}; margin-right: 0.6rem; }
  .ce-log-entry .ce-pending { margin-top: 0.6rem; }

  /* ── CTA ── */
  .ce-cta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; margin-top: clamp(2.25rem, 5vw, 3.5rem); }
  .ce-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.8rem;
    min-height: 44px;
    padding: 0.45rem 0.5rem 0.45rem 1.3rem;
    border-radius: 999px;
    border: 1px solid ${T.hairline};
    background: rgba(232,227,216,0.03);
    color: ${T.bone};
    font-family: ${MONO};
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    text-decoration: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: border-color 0.55s ${EASE}, background 0.55s ${EASE}, transform 0.35s ${EASE};
  }
  .ce-btn:active { transform: scale(0.985); }
  .ce-btn-orb {
    width: 2.2rem; height: 2.2rem;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${T.amberGhost};
    border: 1px solid ${T.hairline};
    flex-shrink: 0;
    transition: transform 0.45s ${EASE}, background 0.45s ${EASE};
  }
  .ce-btn.is-disabled { border-style: dashed; color: ${T.boneDim}; cursor: default; }
  .ce-btn.is-disabled:active { transform: none; }

  /* ── FOOTER ── */
  .ce-foot {
    border-top: 1px solid ${T.hairline};
    padding-top: clamp(2.25rem, 5vw, 3.5rem);
    padding-bottom: clamp(2.25rem, 5vw, 3.5rem);
    padding-bottom: max(clamp(2.25rem, 5vw, 3.5rem), env(safe-area-inset-bottom));
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    font-family: ${MONO};
    font-size: 0.58rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${T.boneDim};
  }

  .ce-line { height: 1px; background: ${T.hairline}; transform-origin: left center; }

  /* ══════════════════════════════════════════════════════════
     HOVER — solo puntatore fine. Su touch questi stati non
     esistono: niente hover "incollato" dopo il tap.
  ══════════════════════════════════════════════════════════ */
  @media (hover: hover) and (pointer: fine) {
    .ce-island:hover { color: ${T.amber}; border-color: ${T.amberDim}; }
    .ce-island:hover .ce-island-arrow { transform: translateX(-3px); }
    .ce-chip:hover { color: ${T.amber}; border-color: ${T.amberDim}; }
    .ce-mod-shell:hover { border-color: rgba(232,227,216,0.2); background: rgba(232,227,216,0.05); }
    .ce-lv-shell:hover { border-color: rgba(232,227,216,0.2); background: rgba(232,227,216,0.05); }
    .ce-lv-shell.is-boss:hover { border-color: ${T.amber}; background: rgba(216,156,74,0.14); }
    .ce-spec-cell:hover { background: #0b0a08; }
    .ce-play:hover .ce-play-orb { transform: scale(1.08); background: rgba(216,156,74,0.18); }
    .ce-btn:hover { border-color: ${T.amberDim}; background: rgba(216,156,74,0.07); }
    .ce-btn:hover .ce-btn-orb { transform: translate(2px, -2px); background: rgba(216,156,74,0.2); }
    .ce-btn.is-disabled:hover { background: rgba(232,227,216,0.03); border-color: ${T.hairline}; }
    .ce-btn.is-disabled:hover .ce-btn-orb { transform: none; background: ${T.amberGhost}; }

    /* Spotlight che segue il cursore sul bento: una sola custom
       property aggiornata in rAF, nessun reflow. */
    .ce-mod-grid::before {
      content: '';
      position: absolute;
      top: 0; right: 0; bottom: 0; left: 0;
      z-index: 0;
      pointer-events: none;
      border-radius: 1.5rem;
      opacity: 0;
      transition: opacity 0.6s ${EASE};
      background: radial-gradient(420px circle at var(--mx) var(--my), rgba(216,156,74,0.09), transparent 62%);
    }
    .ce-mod-grid.is-lit::before { opacity: 1; }
  }

  /* ══════════════════════════════════════════════════════════
     STATI INIZIALI — attivi SOLO con la classe .is-armed, che
     il JS aggiunge prima del paint. Nessun JS ⇒ nessuno stato
     nascosto ⇒ la pagina è sempre leggibile.
  ══════════════════════════════════════════════════════════ */
  @media (prefers-reduced-motion: no-preference) {
    .ce-root.is-armed .ce-clip-inner { transform: translateY(106%); }
    .ce-root.is-armed .ce-nav-item { opacity: 0; transform: translateY(-12px); }
    .ce-root.is-armed .ce-line { transform: scaleX(0); }
    .ce-root.is-armed .ce-reveal { opacity: 0; transform: translateY(26px); }
    .ce-root .ce-runtime-dot { animation: cePulse 2.2s ease-in-out infinite; }
    .ce-root .ce-cursor { animation: ceBlink 1.1s step-end infinite; }
    .ce-root .ce-tick-track { animation: ceTick 46s linear infinite; will-change: transform; }
    .ce-root .ce-map-sweep { animation: ceSweep 7s ease-in-out infinite; will-change: transform; }
  }
  @keyframes cePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.28; transform: scale(0.68); }
  }
  @keyframes ceBlink {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0; }
  }
  @keyframes ceTick {
    from { transform: translate3d(0, 0, 0); }
    to   { transform: translate3d(-50%, 0, 0); }
  }
  @keyframes ceSweep {
    0%   { transform: translate3d(-40%, 0, 0); }
    50%  { transform: translate3d(300%, 0, 0); }
    100% { transform: translate3d(-40%, 0, 0); }
  }

  /* ══════════════════════════════════════════════════════════
     BENTO — spans solo da 900px in su. Sotto: colonna singola.
  ══════════════════════════════════════════════════════════ */
  @media (min-width: 900px) {
    .ce-rail { display: flex; }
    .ce-mod-shell.sp-2 { grid-column: span 2; }
    .ce-mod-shell.sp-3 { grid-column: span 3; }
    .ce-mod-shell.sp-4 { grid-column: span 4; }
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 900px) {
    .ce-overview-grid { grid-template-columns: minmax(0, 1fr); gap: 2.25rem; }
    .ce-prose { border-left: none; border-top: 1px solid ${T.hairline}; padding-left: 0; padding-top: 2.25rem; }
    .ce-prose p { max-width: none; }
    .ce-lv-grid { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 768px) {
    .ce-gal-grid { grid-template-columns: minmax(0, 1fr); }
    .ce-spec-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    /* La minimappa a 40 colonne su schermo stretto resta leggibile
       come pattern: le celle scendono a ~7px, che è esattamente
       l'effetto "minimappa" voluto. Nessuno scroll orizzontale. */
    .ce-map-core { padding: 0.9rem; }
  }
  @media (max-width: 600px) {
    .ce-title { font-size: clamp(2.9rem, 16.5vw, 5rem); letter-spacing: -0.045em; }
    .ce-meta-col { padding: 0.2rem clamp(0.75rem, 3vw, 1.1rem); }
    .ce-meta-col:first-child { padding-left: 0; }
    .ce-island-label { display: none; }
    .ce-island { padding: 0.55rem 0.9rem; }
  }
`;

/* ═══════════════════════════════════════════════════════════════
   DATI — moduli con i FATTI VERI letti in main.c
═══════════════════════════════════════════════════════════════ */
const MODULES = [
  {
    id: 'MOD//01', span: 'sp-4', name: 'Core Loop',
    desc: 'Un solo ciclo governa tutta la vita del processo: campiona il delta time, aggiorna la simulazione in base allo stato corrente, poi disegna. Ogni grandezza fisica è moltiplicata per dt, quindi la velocità del gioco non dipende dalla velocità della macchina.',
    facts: [
      ['LOOP', 'while (!WindowShouldClose())'],
      ['TIMESTEP', 'variabile · dt = GetFrameTime()'],
      ['TARGET', 'SetTargetFPS(60)'],
      ['INTEGRAZIONE', 'Eulero semi-implicito'],
    ],
  },
  {
    id: 'MOD//02', span: 'sp-2', name: 'Collisioni',
    desc: 'AABB risolte per-asse: prima si muove e si corregge X, poi indipendentemente Y. È la scelta che impedisce al player di incastrarsi negli spigoli dei tile.',
    facts: [
      ['TEST', 'CheckCollisionRecs'],
      ['ORDINE', 'asse X → asse Y'],
      ['RISPOSTA', 'repulsione posizionale'],
    ],
  },
  {
    id: 'MOD//03', span: 'sp-2', name: 'Camera 2D',
    desc: 'La camera insegue il player solo in orizzontale, interpolando la posizione a ogni frame: il movimento resta morbido senza mai perdere di vista il personaggio.',
    facts: [
      ['SEGUE', 'Lerp(target.x, player.x, 0.1)'],
      ['ASSE Y', 'ancorata a 200 px'],
      ['OFFSET', 'centro schermo 300 × 200'],
    ],
  },
  {
    id: 'MOD//04', span: 'sp-4', name: 'Game Feel',
    desc: 'Il feedback non è decorazione: è informazione. Ogni impatto alza un valore di "trauma" che decade nel tempo, e lo scuotimento della camera è il trauma al quadrato — così i colpi leggeri si sentono appena e quelli forti scuotono davvero. Il player colpito lampeggia durante l’invulnerabilità.',
    facts: [
      ['SHAKE', 'offset = trauma² × 7 px'],
      ['DECADIMENTO', 'trauma −1.0 / secondo'],
      ['I-FRAMES', '1.0 s · sprite lampeggiante'],
      ['PARTICELLE', 'esplosione a 20 frammenti'],
    ],
  },
  {
    id: 'MOD//05', span: 'sp-3', name: 'Memoria & Pool',
    desc: 'Nessuna allocazione dinamica dentro il game loop. Proiettili e particelle vivono in array a dimensione fissa, riusati tramite un flag di attività: il costo è pagato una volta sola, all’avvio.',
    facts: [
      ['COLPI', 'pool statico · 10 slot'],
      ['PARTICELLE', 'pool statico · 200 slot'],
      ['MALLOC NEL LOOP', 'zero'],
    ],
  },
  {
    id: 'MOD//06', span: 'sp-3', name: 'Stati & Flusso',
    desc: 'Una enum governa l’intera applicazione, letta da due switch paralleli: uno aggiorna, l’altro disegna. Aggiungere una schermata significa aggiungere un caso, non districare condizioni sparse.',
    facts: [
      ['ENUM', 'MENU · GIOCO · GAMEOVER'],
      ['', 'VITTORIA · NEGOZIO'],
      ['PATTERN', 'switch update + switch render'],
    ],
  },
  {
    id: 'MOD//07', span: 'sp-3', name: 'Nemici & IA',
    desc: 'Il pattugliamento non usa waypoint: ogni nemico proietta davanti ai piedi un piccolo sensore rettangolare. Se il sensore non trova terreno, il nemico è sull’orlo del vuoto e inverte la marcia. Le torrette sparano solo se il player è allineato, dal lato giusto e a tiro.',
    facts: [
      ['SENSORE VUOTO', 'rettangolo 5 × 5 px'],
      ['TORRETTA', 'cooldown 1.5 s · portata 300 px'],
      ['ALLINEAMENTO', 'tolleranza ±30 px su Y'],
      ['DIFFICOLTÀ', '×1.5 velocità oltre 100 punti'],
    ],
  },
  {
    id: 'MOD//08', span: 'sp-3', name: 'Economia & Negozio',
    desc: 'Le monete raccolte nei livelli si spendono in una schermata dedicata che modifica direttamente le costanti del motore: non oggetti in inventario, ma parametri di gioco riscritti a runtime.',
    facts: [
      ['CUORE', 'vita massima +1 (cap 6)'],
      ['STIVALI', 'velocità del player +50'],
      ['PROIETTILI', 'velocità del colpo +30'],
    ],
  },
];

const LEVELS = [
  {
    id: 'LV.01', name: 'Discesa',
    desc: 'Il livello che insegna il vocabolario: muri, casse distruttibili, botole attraversabili, monete e cuori. Lo sfondo si spegne progressivamente mentre avanzi — la luce non è un tema grafico, è un timer.',
    tag: 'TILESET A',
  },
  {
    id: 'LV.02', name: 'Profondità',
    desc: 'Stessa grammatica, tileset nuovo: muri, casse e cuori cambiano forma. Le torrette diventano una minaccia costante e il percorso richiede di usare il doppio salto invece di subirlo.',
    tag: 'TILESET B',
  },
  {
    id: 'LV.03', name: 'Boss', boss: true,
    desc: 'L’ultimo livello chiude la storia con uno scontro finale. Struttura, pattern d’attacco e condizione di vittoria del boss sono raccontati qui sotto.',
    tag: 'BOSS FIGHT',
    ask: 'seba: descrivi il boss — come attacca, quante fasi ha, come si sconfigge, cosa succede quando cade.',
  },
];

const SPECS = [
  { k: 'LINGUAGGIO',  v: 'C — 100% del motore' },
  { k: 'DIPENDENZE',  v: 'Raylib · unica' },
  { k: 'GENERE',      v: 'Platformer 2D' },
  { k: 'LIVELLI',     v: '3 · boss finale' },
  { k: 'GRIGLIA',     v: '10 × 100 tile · 40 px' },
  { k: 'RISOLUZIONE', v: '600 × 400 · camera 2D' },
  { k: 'SORGENTE',    v: 'main.c · single file' },
  { k: 'TOOLCHAIN',   v: 'VS Code · gcc', tbd: true },
];

const LOGS = [
  {
    id: 'LOG//01', title: 'LA SFIDA PIÙ DURA',
    ask: 'seba: il problema più difficile del motore e come l’hai risolto — 3-4 frasi concrete.',
  },
  {
    id: 'LOG//02', title: 'UNA DECISIONE DI DESIGN',
    ask: 'seba: una scelta architetturale di cui sei orgoglioso, e cosa hai scartato per farla.',
  },
  {
    id: 'LOG//03', title: 'COSA INSEGNA IL C',
    ask: 'seba: la lezione che scrivere un motore in C ti ha dato e che il web, da solo, non ti avrebbe dato.',
  },
];

const SECTIONS = [
  { id: 'sec-overview',  label: 'Overview' },
  { id: 'sec-arch',      label: 'Architettura' },
  { id: 'sec-map',       label: 'Level Data' },
  { id: 'sec-campaign',  label: 'Campagna' },
  { id: 'sec-capture',   label: 'Capture' },
  { id: 'sec-specs',     label: 'Specs' },
  { id: 'sec-log',       label: 'Design Log' },
];

/* JSON-LD — optional chaining ovunque: se seo.config cambia forma,
   la pagina non va in schermata bianca a tempo di modulo. */
const BASE_URL = (SITE && SITE.baseUrl) || '';
const AUTHOR   = (SITE && SITE.name) || 'Seba Mollo';
const PAGE_URL = `${BASE_URL}/projects/c-game-engine`;

const JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareSourceCode',
      name: 'Forge Engine',
      description:
        'Game engine 2D per platformer scritto da zero in C puro, con Raylib come unica dipendenza: game loop, collisioni AABB per-asse, camera 2D, sistema a particelle e macchina a stati.',
      url: PAGE_URL,
      author: { '@type': 'Person', name: AUTHOR, url: BASE_URL || undefined },
      programmingLanguage: 'C',
      runtimePlatform: 'Raylib',
      codeSampleType: 'full solution',
    },
    {
      '@type': 'VideoGame',
      name: 'Forge Engine',
      description:
        'Platformer 2D in tre livelli con boss finale, costruito sul motore Forge Engine scritto in C con Raylib.',
      url: PAGE_URL,
      author: { '@type': 'Person', name: AUTHOR },
      genre: 'Platformer',
      gamePlatform: 'PC',
      applicationCategory: 'Game',
    },
  ],
});

/* ═══════════════════════════════════════════════════════════════
   HOOK — layout effect isomorfo (niente warning in prerender)
═══════════════════════════════════════════════════════════════ */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* ═══════════════════════════════════════════════════════════════
   PLACEHOLDER DI COPY
═══════════════════════════════════════════════════════════════ */
function Pending({ children }) {
  return (
    <span className="ce-pending" role="note">
      <span className="ce-pending-tag">[ DA COMPLETARE ]</span>
      <span className="ce-pending-body">{children}</span>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MEDIA SLOT — Double-Bezel con stato "ASSET PENDING"
   ───────────────────────────────────────────────────────────────
   · Lo spazio è riservato SEMPRE (aspect-ratio + fallback padding):
     quando i file arriveranno non ci sarà nessun salto di layout.
   · Il layer pending sta sotto il media; al primo load il media
     sfuma sopra. In errore il pending resta: mai icona rotta.
   · Video: play/pause via IntersectionObserver, mai autoplay con
     Save-Data o reduced-motion, e ogni Promise è protetta da un
     flag `alive` così non si aggiorna lo stato dopo lo smontaggio.
═══════════════════════════════════════════════════════════════ */
function MediaSlot({ kind = 'image', src, poster, alt, label, meta, ratio = '640 / 428', portrait = false }) {
  const [ready, setReady]     = useState(false);
  const [failed, setFailed]   = useState(false);
  const [needsTap, setNeedsTap] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const reduced  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const saveData = navigator.connection && navigator.connection.saveData === true;
      return Boolean(reduced || saveData);
    } catch {
      return false;
    }
  });

  const videoRef = useRef(null);
  const coreRef  = useRef(null);

  /* iOS Safari NON imposta la proprietà `muted` dal solo attributo JSX in
     tutti i casi, e un video non realmente muto non ha diritto all'autoplay:
     lo forziamo sull'elemento DOM appena esiste. */
  useEffect(() => {
    const video = videoRef.current;
    if (kind === 'video' && video) video.muted = true;
  }, [kind]);

  /* Governo del playback. NON dipende da `ready`: su iOS con
     preload="metadata" l'evento che segnala "pronto" può non arrivare
     finché la riproduzione non è già iniziata — legarlo a ready creava
     uno stallo (niente play ⇒ niente evento ⇒ niente play). */
  useEffect(() => {
    if (kind !== 'video' || needsTap || failed) return undefined;
    const video = videoRef.current;
    const core  = coreRef.current;
    if (!video || !core || typeof IntersectionObserver === 'undefined') return undefined;

    let alive = true;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          const p = video.play();
          if (p && typeof p.catch === 'function') {
            // Autoplay negato (risparmio energetico iOS, policy del browser):
            // si passa al bottone di play esplicito invece di restare al buio.
            p.catch(() => { if (alive) setNeedsTap(true); });
          }
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(core);

    return () => {
      alive = false;
      io.disconnect();
      try { video.pause(); } catch { /* elemento già rimosso */ }
    };
  }, [kind, needsTap, failed]);

  const handleReady = useCallback(() => {
    setFailed(false);
    setReady(true);
  }, []);

  const handleTap = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const p = video.play();
    if (p && typeof p.then === 'function') {
      p.then(() => setNeedsTap(false)).catch(() => { /* il browser rifiuta: resta il bottone */ });
    } else {
      setNeedsTap(false);
    }
  }, []);

  const showPending = !ready || failed;

  return (
    <figure style={{ position: 'relative', margin: 0 }}>
      <div className="ce-slot-head" aria-hidden="true">
        <span className="ce-slot-label">{label}</span>
        <span className="ce-slot-meta">{meta}</span>
      </div>

      <div className="ce-slot-shell">
        <div
          ref={coreRef}
          className={`ce-slot-core${portrait ? ' is-portrait' : ''}`}
          style={{ aspectRatio: ratio }}
        >
          <div className={`ce-slot-pending${showPending ? '' : ' is-hidden'}`} aria-hidden={!showPending}>
            <span className="ce-bracket ce-bracket-tl" />
            <span className="ce-bracket ce-bracket-tr" />
            <span className="ce-bracket ce-bracket-bl" />
            <span className="ce-bracket ce-bracket-br" />
            <span className="ce-slot-pending-label">
              [ MEDIA IN ARRIVO ]<span className="ce-cursor" aria-hidden="true" />
            </span>
            <span className="ce-slot-pending-sub">{meta} — SLOT RISERVATO</span>
          </div>

          {kind === 'video' ? (
            <video
              ref={videoRef}
              className={`ce-slot-media${ready && !failed ? ' is-ready' : ''}`}
              src={src}
              poster={poster}
              muted
              loop
              playsInline
              /* Safari iOS vuole ANCHE l'attributo in kebab-case */
              webkit-playsinline="true"
              preload="metadata"
              aria-label={alt}
              /* Tre eventi invece di uno: `loadeddata` da solo non arriva
                 mai su iOS finché il video non parte. `loadedmetadata` è
                 il primo che arriva ovunque, `canplay` copre i browser che
                 saltano gli altri due. Il primo che scatta vince. */
              onLoadedMetadata={handleReady}
              onLoadedData={handleReady}
              onCanPlay={handleReady}
              onError={() => { setFailed(true); setReady(false); }}
            />
          ) : (
            <img
              className={`ce-slot-media${ready && !failed ? ' is-ready' : ''}`}
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              onLoad={handleReady}
              onError={() => { setFailed(true); setReady(false); }}
            />
          )}

          {/* Il bottone NON dipende più da `ready`: se l'autoplay viene
              negato prima che il video si dichiari pronto, l'utente deve
              comunque avere un modo per farlo partire. */}
          {kind === 'video' && !failed && needsTap && (
            <button type="button" className="ce-play" onClick={handleTap} aria-label="Riproduci la clip di gameplay">
              <span className="ce-play-orb">
                <svg width="18" height="18" viewBox="0 0 24 24" fill={T.bone} aria-hidden="true">
                  <polygon points="7,4 21,12 7,20" />
                </svg>
              </span>
            </button>
          )}
        </div>
      </div>

      <figcaption className="ce-sr">{alt}</figcaption>
    </figure>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MINIMAPPA — dati reali di mappe[0]
═══════════════════════════════════════════════════════════════ */
function TileMap() {
  return (
    <div className="ce-map-shell">
      <div className="ce-map-core">
        <div className="ce-map-sweep" aria-hidden="true" />
        <div className="ce-map-grid" role="img" aria-label="Minimappa delle prime 40 colonne del primo livello di Forge Engine, ricostruita dalla matrice di tile del sorgente C">
          {TILEMAP.map((row, y) =>
            row.split('').map((cell, x) => (
              <span key={`${y}-${x}`} className={`ce-cell ce-cell-${cell}`} aria-hidden="true" />
            ))
          )}
        </div>
        <div className="ce-map-foot">
          {TILE_LEGEND.map((l) => (
            <span className="ce-leg" key={l.id}>
              <span className={`ce-leg-sw ce-cell-${l.id}`} aria-hidden="true" />
              <span className="ce-leg-t"><b>{l.id}</b> · {l.k} — {l.d}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPALE
═══════════════════════════════════════════════════════════════ */
export default function CGameEngine() {
  const pageRef    = useRef(null);
  const fpsRef     = useRef(null);
  const runtimeRef = useRef(null);
  const gridRef    = useRef(null);
  const tickRef    = useRef(null);
  const mapRef     = useRef(null);
  const railRef    = useRef(null);

  /* L'hook di transizione può, in teoria, non restituire una funzione
     (ordine dei provider, refactor futuri): in quel caso il CTA resta
     un link normale invece di crashare al click. */
  const tNavigate = useTransitionNavigate();

  const handleReturnToArchive = useCallback((e) => {
    if (typeof tNavigate !== 'function') return; // fallback: navigazione nativa
    e.preventDefault();
    tNavigate('/works');
  }, [tNavigate]);

  /* ── MOTION ─────────────────────────────────────────────────── */
  useIsoLayoutEffect(() => {
    const root = pageRef.current;
    if (!root) return undefined;

    let reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { reduced = false; }

    /* Reduced motion: nessuno stato nascosto, nessun tween, nessun
       ticker. La pagina è già completa così com'è nel DOM. */
    if (reduced) return undefined;

    /* ARMA gli stati iniziali prima del paint: impossibile vedere il
       contenuto comparire-e-sparire (nessun FOUC). */
    root.classList.add('is-armed');

    let rafId = 0;
    let fpsIO = null;
    let revealTimer = 0;
    let fpsAttached = false;

    /* ── FPS reale della pagina: textContent su ref, mai setState ── */
    let frames = 0;
    let lastTs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const fpsTick = () => {
      frames += 1;
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const delta = now - lastTs;
      if (delta >= 500) {
        const fps = Math.round((frames * 1000) / delta);
        if (fpsRef.current) fpsRef.current.textContent = String(Math.max(0, Math.min(fps, 999)));
        frames = 0;
        lastTs = now;
      }
    };
    const attachFps = () => { if (!fpsAttached) { gsap.ticker.add(fpsTick); fpsAttached = true; } };
    const detachFps = () => { if (fpsAttached) { gsap.ticker.remove(fpsTick); fpsAttached = false; } };

    const ctx = gsap.context(() => {
      /* Un ciclo completo di layout+paint prima che GSAP legga gli
         stati iniziali scritti dal CSS. */
      rafId = requestAnimationFrame(() => {
        gsap.to('.ce-clip-inner', {
          translateY: '0%',
          duration: 1.15,
          stagger: 0.045,
          ease: 'expo.out',
          delay: 0.12,
        });

        gsap.to('.ce-nav-item', {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.08,
          delay: 0.45,
          ease: 'power2.out',
        });

        gsap.to('.ce-line-hero', { scaleX: 1, duration: 1.4, delay: 0.4, ease: 'expo.inOut' });

        /* Un solo osservatore per tutti i reveal (batch), invece di
           N ScrollTrigger indipendenti. */
        ScrollTrigger.batch('.ce-reveal', {
          start: 'top 88%',
          once: true,
          onEnter: (batch) => {
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              duration: 0.85,
              stagger: 0.07,
              ease: 'power3.out',
              overwrite: 'auto',
            });
          },
        });

        gsap.utils.toArray('.ce-line-scroll').forEach((el) => {
          gsap.to(el, {
            scaleX: 1,
            duration: 1.2,
            ease: 'expo.inOut',
            scrollTrigger: { trigger: el, start: 'top 92%', once: true },
          });
        });
      });

      /* FPS attivo solo mentre il readout è visibile */
      if (runtimeRef.current && typeof IntersectionObserver !== 'undefined') {
        fpsIO = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (!entry) return;
            if (entry.isIntersecting) attachFps(); else detachFps();
          },
          { threshold: 0.01 }
        );
        fpsIO.observe(runtimeRef.current);
      }
    }, pageRef);

    /* I font custom cambiano le metriche DOPO il primo layout: senza
       questo refresh i trigger restano su misure vecchie. */
    let fontsCancelled = false;
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!fontsCancelled) ScrollTrigger.refresh();
      }).catch(() => { /* API non disponibile: ignora */ });
    }

    /* RETE DI SICUREZZA: se per qualsiasi motivo un reveal non è
       partito (misure sbagliate, refresh saltato, browser esotico),
       dopo 2.5s il contenuto viene mostrato comunque. Il testo non
       può MAI restare invisibile. */
    revealTimer = window.setTimeout(() => {
      const hidden = root.querySelectorAll('.ce-reveal');
      hidden.forEach((el) => {
        const op = window.getComputedStyle(el).opacity;
        if (parseFloat(op) < 0.05) {
          gsap.to(el, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
        }
      });
    }, 2500);

    return () => {
      fontsCancelled = true;
      window.clearTimeout(revealTimer);
      cancelAnimationFrame(rafId);
      if (fpsIO) fpsIO.disconnect();
      detachFps();
      ctx.revert();          // rimuove SOLO i trigger e gli stili di questa pagina
      root.classList.remove('is-armed');
    };
  }, []);

  /* ── SPOTLIGHT sul bento: solo puntatore fine, coalescato in rAF ── */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    let fine = false;
    try {
      fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch { fine = false; }
    if (!fine) return undefined;

    let raf = 0;
    let px = 0;
    let py = 0;

    const apply = () => {
      raf = 0;
      grid.style.setProperty('--mx', `${px}px`);
      grid.style.setProperty('--my', `${py}px`);
    };
    const onMove = (e) => {
      const r = grid.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onEnter = () => grid.classList.add('is-lit');
    const onLeave = () => {
      grid.classList.remove('is-lit');
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    grid.addEventListener('pointermove', onMove, { passive: true });
    grid.addEventListener('pointerenter', onEnter, { passive: true });
    grid.addEventListener('pointerleave', onLeave, { passive: true });

    return () => {
      grid.removeEventListener('pointermove', onMove);
      grid.removeEventListener('pointerenter', onEnter);
      grid.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* ── Marquee e sweep: fermi quando fuori dal viewport (GPU a riposo) ── */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const targets = [tickRef.current, mapRef.current].filter(Boolean);
    if (!targets.length) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;
          const anim = el.querySelector('.ce-tick-track, .ce-map-sweep');
          if (anim) anim.style.animationPlayState = entry.isIntersecting ? 'running' : 'paused';
        });
      },
      { threshold: 0 }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  /* ── Rail HUD: sezione attiva via IntersectionObserver ── */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof IntersectionObserver === 'undefined') return undefined;

    const nodes = SECTIONS
      .map((s) => document.getElementById(s.id))
      .filter(Boolean);
    if (!nodes.length) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          const items = rail.querySelectorAll('.ce-rail-item');
          items.forEach((item) => {
            item.classList.toggle('is-active', item.dataset.target === id);
          });
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <SEO />
      <Helmet>
        <script type="application/ld+json">{JSONLD}</script>
      </Helmet>
      <style>{CSS}</style>

      <div ref={pageRef} className="ce-root">
        <div className="ce-grain" aria-hidden="true" />

        {/* ══ NAV A ISOLE ══ */}
        <header className="ce-nav">
          <Link
            to="/"
            state={{ scrollToWorks: true }}
            className="ce-island ce-nav-item"
            aria-label="Torna all'indice dei progetti"
          >
            <svg
              className="ce-island-arrow"
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>SYS.RETURN</span>
          </Link>

          <span className="ce-island ce-nav-item ce-island-tag">
            <span className="ce-island-dot" aria-hidden="true" />
            <span className="ce-island-label">CASE STUDY</span>
            <span>// 03</span>
          </span>
        </header>

        {/* ══ RAIL HUD ══ */}
        <nav ref={railRef} className="ce-rail" aria-hidden="true">
          {SECTIONS.map((s) => (
            <span className="ce-rail-item" data-target={s.id} key={s.id}>
              <span>{s.label}</span>
              <i className="ce-rail-tick" />
            </span>
          ))}
        </nav>

        {/* ══ HERO ══ */}
        <section className="ce-hero ce-wrap">
          <div className="ce-eyebrow-row">
            <span className="ce-clip-wrap"><span className="ce-clip-inner ce-eyebrow-sys">[ SYS//C-ENGINE-01 ]</span></span>
            <span className="ce-clip-wrap"><span className="ce-clip-inner ce-eyebrow-dim">REV 1.0</span></span>
            <span className="ce-clip-wrap"><span className="ce-clip-inner ce-eyebrow-dim">2026</span></span>
          </div>

          <h1 className="ce-title">
            <span className="ce-sr">Forge Engine</span>
            <span className="ce-title-line" aria-hidden="true">
              {'FORGE'.split('').map((c, i) => (
                <span className="ce-clip-wrap" key={`a-${i}`}>
                  <span className="ce-clip-inner ce-char">{c}</span>
                </span>
              ))}
            </span>
            <span className="ce-title-line" aria-hidden="true">
              {'ENGINE.'.split('').map((c, i) => (
                <span className="ce-clip-wrap" key={`b-${i}`}>
                  <span className="ce-clip-inner ce-char ce-title-ghost">{c}</span>
                </span>
              ))}
            </span>
          </h1>

          <p className="ce-lede">
            Motore 2D per platformer, <strong>scritto interamente in C</strong>. Una sola
            dipendenza: <strong>Raylib</strong>. Game loop, collisioni, camera, particelle e
            macchina a stati costruiti da zero — nessun framework in mezzo, nessun garbage
            collector a decidere quando fermare il gioco.
          </p>

          <div className="ce-chip-row">
            {['C', 'Raylib', 'Platformer 2D', 'Tilemap', 'Boss Fight'].map((tag) => (
              <span key={tag} className="ce-chip">{tag}</span>
            ))}
          </div>

          <div>
            <div className="ce-line ce-line-hero" style={{ marginBottom: 'clamp(1.2rem, 2.5vw, 2rem)' }} />
            <div className="ce-meta-row">
              <div className="ce-meta-cols">
                {[
                  ['ROLE', 'Engine Programmer'],
                  ['STACK', 'C + Raylib'],
                  ['SCOPE', '3 livelli + boss'],
                  ['YEAR', '2026'],
                ].map(([k, v]) => (
                  <div className="ce-meta-col" key={k}>
                    <p className="ce-meta-k">{k}</p>
                    <p className="ce-meta-v">{v}</p>
                  </div>
                ))}
              </div>

              <span ref={runtimeRef} className="ce-runtime" aria-hidden="true">
                <span className="ce-runtime-dot" />
                RUNTIME&nbsp;//&nbsp;<span ref={fpsRef} className="ce-runtime-val">—</span>&nbsp;FPS
              </span>
            </div>
          </div>

          <div className="ce-reveal">
            <MediaSlot
              kind="video"
              src={`${ASSET_DIR}/gameplay-01.mp4`}
              poster={`${ASSET_DIR}/poster-gameplay-01.jpg`}
              alt="Clip di gameplay di Forge Engine: il player attraversa un livello a tile del platformer 2D, raccoglie monete e schiva i nemici"
              label="OUTPUT // GAMEPLAY-01"
              meta="CH-01 · 1280×856 · CAPTURE"
              ratio="640 / 428"
            />
          </div>
        </section>

        {/* ══ MARQUEE TELEMETRIA ══ */}
        <div ref={tickRef} className="ce-tick" aria-hidden="true">
          <div className="ce-tick-track">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span className="ce-tick-item" key={`${t}-${i}`}>{t}</span>
            ))}
          </div>
        </div>

        {/* ══ 01 — OVERVIEW ══ */}
        <section id="sec-overview" className="ce-section ce-wrap">
          <div className="ce-sec-head ce-reveal">
            <span className="ce-sec-label">[ 01 — Overview ]</span>
            <span className="ce-sec-meta">&gt;&gt;&gt; cat briefing.txt</span>
          </div>

          <div className="ce-overview-grid">
            <h2 className="ce-h2 ce-reveal">
              Sotto non c’è un motore. <em>Questo</em> è il motore.
            </h2>

            <div className="ce-prose ce-reveal">
              <p>
                Forge Engine è un game engine 2D per platformer in stile <strong>Super Mario
                Bros</strong>, scritto interamente in <strong>C</strong>. L’unica libreria
                esterna è <strong>Raylib</strong>, usata come strato minimo verso la macchina:
                apre la finestra, legge la tastiera, disegna una texture. Tutto il resto —
                gravità, collisioni, camera, particelle, stati, economia — è codice scritto a mano.
              </p>
              <p>
                La scelta non è nostalgia, è <strong>controllo</strong>. Nessun garbage collector
                che decide quando fermare il frame, nessuna astrazione che nasconde il costo di
                un’operazione. Le entità vivono in <code>struct</code> con campi espliciti, i
                proiettili e le particelle in array a dimensione fissa riusati con un flag: dentro
                il game loop non viene allocata <strong>nemmeno una volta</strong> memoria dinamica.
              </p>
              <p>
                Il gioco che ci gira sopra è una campagna in <strong>tre livelli</strong>, con una
                storia raccontata e uno <strong>scontro finale contro un boss</strong>. Tutti i
                numeri che leggi in questa pagina — gravità, forza di salto, raggio delle torrette,
                dimensione dei pool — sono le costanti reali dichiarate nel sorgente.
              </p>
            </div>
          </div>
        </section>

        {/* ══ 02 — ARCHITETTURA ══ */}
        <section id="sec-arch" className="ce-section ce-wrap">
          <div className="ce-sec-head ce-reveal">
            <span className="ce-sec-label">[ 02 — Architecture ]</span>
            <span className="ce-sec-meta">8 MODULI · SYSTEM MAP</span>
          </div>

          <div ref={gridRef} className="ce-mod-grid">
            {MODULES.map((mod) => (
              <div className={`ce-mod-shell ce-reveal ${mod.span}`} key={mod.id}>
                <article className="ce-mod-core">
                  <div className="ce-mod-head">
                    <span className="ce-mod-id">{mod.id}</span>
                    <span className="ce-mod-bus" aria-hidden="true" />
                  </div>
                  <h3 className="ce-mod-name">{mod.name}</h3>
                  <p className="ce-mod-desc">{mod.desc}</p>
                  <dl className="ce-mod-facts">
                    {mod.facts.map(([k, v], i) => (
                      <div className="ce-mod-fact" key={`${mod.id}-${i}`}>
                        <b>{k || '·'}</b>
                        <span>{v}</span>
                      </div>
                    ))}
                  </dl>
                </article>
              </div>
            ))}
          </div>
        </section>

        {/* ══ 03 — LEVEL DATA ══ */}
        <section id="sec-map" className="ce-section ce-wrap">
          <div className="ce-sec-head ce-reveal">
            <span className="ce-sec-label">[ 03 — Level Data ]</span>
            <span className="ce-sec-meta">MAPPE[0] · COL 0-39 / 100</span>
          </div>

          <div className="ce-overview-grid" style={{ marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
            <h2 className="ce-h2 ce-reveal">
              Il livello <em>è</em> una matrice di interi.
            </h2>
            <div className="ce-prose ce-reveal">
              <p>
                Nessun editor visuale, nessun formato esterno da parsare: ogni livello è una
                matrice <code>int[10][100]</code> dichiarata direttamente nel sorgente, dove ogni
                cifra è un tile. Costruire un livello significa scrivere numeri, e leggere il
                livello significa leggere il codice.
              </p>
              <p>
                Il vantaggio è la <strong>densità</strong>: la mappa vive nel binario, si carica
                con una <code>memcpy</code> e non può mai essere un file mancante a runtime. Il
                prezzo è che il level design passa dall’occhio alla tastiera.
              </p>
              <p>
                Qui sotto le <strong>prime 40 colonne del primo livello</strong>, ricostruite dai
                dati reali del sorgente.
              </p>
            </div>
          </div>

          <div ref={mapRef} className="ce-reveal">
            <TileMap />
          </div>
        </section>

        {/* ══ 04 — CAMPAGNA ══ */}
        <section id="sec-campaign" className="ce-section ce-wrap">
          <div className="ce-sec-head ce-reveal">
            <span className="ce-sec-label">[ 04 — Campagna ]</span>
            <span className="ce-sec-meta">3 LIVELLI · BOSS FINALE</span>
          </div>

          <div className="ce-lv-grid">
            {LEVELS.map((lv) => (
              <div className={`ce-lv-shell ce-reveal${lv.boss ? ' is-boss' : ''}`} key={lv.id}>
                <article className="ce-lv-core">
                  <div className="ce-lv-top">
                    <span className="ce-lv-id">{lv.id}</span>
                    {lv.boss
                      ? <span className="ce-lv-badge">{lv.tag}</span>
                      : <span className="ce-slot-meta">{lv.tag}</span>}
                  </div>
                  <h3 className="ce-lv-name">{lv.name}</h3>
                  <p className="ce-lv-desc">{lv.desc}</p>
                  {lv.ask ? <Pending>{lv.ask}</Pending> : null}
                </article>
              </div>
            ))}
          </div>

          <div className="ce-log-shell ce-reveal" style={{ marginTop: 'clamp(1.5rem, 3vw, 2.5rem)' }}>
            <div className="ce-log-core">
              <div className="ce-log-bar">
                <span className="ce-log-dots" aria-hidden="true">
                  <span className="ce-log-dot ce-dot-r" />
                  <span className="ce-log-dot ce-dot-y" />
                  <span className="ce-log-dot ce-dot-g" />
                </span>
                <span className="ce-log-file">forge/story.txt</span>
              </div>
              <div className="ce-log-body">
                <div className="ce-log-entry">
                  <p className="ce-log-entry-head">
                    <span className="ce-log-prompt">&gt;&gt;&gt;</span>
                    NARRATIVA — LA STORIA DELLA CAMPAGNA
                  </p>
                  <Pending>
                    seba: raccontala in 4-5 frasi — chi è il protagonista, cosa lo spinge ad
                    andare avanti, come la storia viene comunicata al giocatore (schermate,
                    testo, ambiente) e come si chiude dopo il boss.
                  </Pending>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 05 — GAMEPLAY CAPTURE ══ */}
        <section id="sec-capture" className="ce-section ce-wrap">
          <div className="ce-sec-head ce-reveal">
            <span className="ce-sec-label">[ 05 — Gameplay Capture ]</span>
            <span className="ce-sec-meta">4 SLOT · IN ATTESA DEI MEDIA</span>
          </div>

          <div className="ce-gal-grid">
            <div className="ce-gal-wide ce-reveal">
              <MediaSlot
                kind="video"
                src={`${ASSET_DIR}/gameplay-02.mp4`}
                poster={`${ASSET_DIR}/poster-gameplay-02.jpg`}
                alt="Clip dello scontro finale di Forge Engine: il player affronta il boss nel terzo livello"
                label="CAPTURE // BOSS-FIGHT"
                meta="CH-02 · 1280×856 · VIDEO"
                ratio="640 / 428"
              />
            </div>

            <div className="ce-reveal">
              <MediaSlot
                kind="image"
                src={`${ASSET_DIR}/screenshot-01.webp`}
                alt="Screenshot del primo livello di Forge Engine: piattaforme, casse distruttibili e monete da raccogliere"
                label="FRAME // LIVELLO-01"
                meta="CH-03 · 1280×856 · STILL"
                ratio="640 / 428"
              />
            </div>

            <div className="ce-reveal">
              <MediaSlot
                kind="image"
                src={`${ASSET_DIR}/immagineBoss.jpg`}
                alt="Screenshot del secondo livello di Forge Engine: nuovo tileset e torrette ostili lungo il percorso"
                label="FRAME // LIVELLO-02"
                meta="CH-04 · 1280×856 · STILL"
                ratio="640 / 428"
              />
            </div>

            <div className="ce-gal-wide ce-reveal">
              <MediaSlot
                kind="image"
                src={`${ASSET_DIR}/immagineNegozio .jpg`}
                alt="Screenshot del negozio di Forge Engine: gli oggetti acquistabili con le monete raccolte e il saldo del giocatore"
                label="FRAME // NEGOZIO"
                meta="CH-05 · 1280×856 · UI"
                ratio="640 / 428"
              />
            </div>
          </div>
        </section>

        {/* ══ 06 — SPEC SHEET ══ */}
        <section id="sec-specs" className="ce-section ce-wrap">
          <div className="ce-sec-head ce-reveal">
            <span className="ce-sec-label">[ 06 — Tech Specs ]</span>
            <span className="ce-sec-meta">UNIT · C-ENGINE-01</span>
          </div>

          <div className="ce-spec-grid ce-reveal">
            {SPECS.map((cell) => (
              <div className={`ce-spec-cell${cell.tbd ? ' is-tbd' : ''}`} key={cell.k}>
                <p className="ce-spec-k">{cell.k}</p>
                <p className="ce-spec-v">{cell.v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══ 07 — DESIGN LOG ══ */}
        <section id="sec-log" className="ce-section ce-wrap">
          <div className="ce-sec-head ce-reveal">
            <span className="ce-sec-label">[ 07 — Design Log ]</span>
            <span className="ce-sec-meta">ENGINEERING NOTES</span>
          </div>

          <div className="ce-log-shell ce-reveal">
            <div className="ce-log-core">
              <div className="ce-log-bar">
                <span className="ce-log-dots" aria-hidden="true">
                  <span className="ce-log-dot ce-dot-r" />
                  <span className="ce-log-dot ce-dot-y" />
                  <span className="ce-log-dot ce-dot-g" />
                </span>
                <span className="ce-log-file">forge/design-log.txt</span>
              </div>
              <div className="ce-log-body">
                {LOGS.map((log) => (
                  <div className="ce-log-entry" key={log.id}>
                    <p className="ce-log-entry-head">
                      <span className="ce-log-prompt">&gt;&gt;&gt;</span>
                      {log.id} — {log.title}
                    </p>
                    <Pending>{log.ask}</Pending>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ce-cta-row ce-reveal">
            {/* Repo non ancora pubblica: pillola disabilitata, NON un link rotto.
                Quando l'URL esisterà, sostituire questo <span> con:
                <a className="ce-btn" href="…" target="_blank" rel="noopener noreferrer"> */}
            <span className="ce-btn is-disabled" aria-disabled="true">
              [ REPO // COMING SOON ]
              <span className="ce-btn-orb" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter">
                  <rect x="5" y="11" width="14" height="9" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
            </span>

            <a className="ce-btn" href="/works" onClick={handleReturnToArchive}>
              RETURN TO ARCHIVE
              <span className="ce-btn-orb" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter">
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
              </span>
            </a>
          </div>
        </section>

        {/* ══ FOOTER ══ */}
        <footer className="ce-foot ce-wrap">
          <span>FORGE ENGINE — C / RAYLIB — 2026</span>
          <Link to="/" state={{ scrollToWorks: true }} className="ce-island">
            <svg
              className="ce-island-arrow"
              width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>SYS.RETURN</span>
          </Link>
        </footer>
      </div>
    </>
  );
}