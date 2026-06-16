import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from 'react-router-dom';

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — "Cyber-Luxury"
═══════════════════════════════════════════════════════════════ */
const C = {
  bgDeep: '#020100',
  bg:     '#050302',
  bgPure: '#000000',
  accent: '#F4A261',
  gold:   '#E9C46A',
  text:   '#F0E6D3',
  muted:  'rgba(240,230,211,0.42)',
  dim:    'rgba(240,230,211,0.12)',
  rail:   'rgba(240,230,211,0.07)',
};
const FONT = "'Outfit','Cabinet Grotesk','Geist',system-ui,sans-serif";
const MONO = "'JetBrains Mono','ui-monospace','SFMono-Regular',Menlo,monospace";

/* ═══════════════════════════════════════════════════════════════
   GLOBAL CSS
   ─────────────────────────────────────────────────────────────
   NB CHIRURGICO: tutte le classi lette da GSAP e i loro stati
   iniziali sono INTATTI → .s3-clip-inner(translateY110%),
   .s3-line(scaleX0), .s3-nav(opacity0), .s3-crosshair, .s3-tag,
   .s3-scroll-fade, .s3-scroll-line, curtain/video. Le fix perf
   (overflow-x:clip, overscroll-behavior-x:contain, touch-action)
   restano dove erano. Qui cambia SOLO l'estetica.
═══════════════════════════════════════════════════════════════ */
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    scroll-behavior: auto;
    /*
      FIX 2 — overflow-x: clip (non hidden)
      ────────────────────────────────────────────────────────────────
      clip: clippa il contenuto orizzontale SENZA creare un scroll
      container o un overflow containment context. A differenza di
      overflow:hidden, non partecipa al hit-testing iOS per lo scroll,
      quindi non interferisce mai con Lenis né con lo scroll nativo.
      Supportato: Safari ≥ 15.4, Chrome ≥ 90, Firefox ≥ 81.
      ────────────────────────────────────────────────────────────────
    */
    overflow-x: clip;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #020100; }
  ::-webkit-scrollbar-thumb { background: rgba(244,162,97,0.35); }

  /* ── GRAIN / NOISE OVERLAY GLOBALE ──
     Pseudo-layer fisso, pointer-events:none, z sistemico (50, sotto la nav=100).
     SVG fractalNoise desaturato (saturate 0) → grana fotografica monocroma che
     toglie il "flat digitale". È fisso → non scrolla, repaint trascurabile. */
  .s3-grain {
    position: fixed;
    inset: 0;
    z-index: 50;
    pointer-events: none;
    opacity: 0.05;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 140px 140px;
  }

  /* ── Clip mask per i reveal del testo (GSAP) ── */
  .s3-clip-wrap {
    overflow: hidden;
    display: block;
  }
  .s3-clip-inner {
    display: block;
    transform: translateY(110%);
  }

  /* ── Linee animate (GSAP) ── */
  .s3-line {
    transform-origin: left center;
    transform: scaleX(0);
  }

  /* ── Header nav ── */
  .s3-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    padding: clamp(1rem, 2.5vw, 1.5rem) clamp(1.5rem, 5vw, 4rem);
    display: flex;
    justify-content: space-between;
    align-items: center;
    mix-blend-mode: normal;
    opacity: 0;
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
  }
  .s3-nav::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(2,1,0,0.92) 0%, rgba(2,1,0,0.4) 60%, transparent 100%);
    pointer-events: none;
  }
  .s3-nav::after {
    content: '';
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(244,162,97,0.35) 50%, transparent);
    pointer-events: none;
  }
  .s3-back-link {
    font-family: ${MONO};
    font-size: 0.72rem;
    color: rgba(240,230,211,0.5);
    text-decoration: none;
    letter-spacing: 0.12em;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    transition: color 0.25s ease, gap 0.35s cubic-bezier(0.32,0.72,0,1);
    position: relative;
    z-index: 1;
  }
  .s3-back-link:hover { color: #F4A261; gap: 0.9rem; }
  .s3-back-link span { color: #F4A261; font-size: 1rem; }
  .s3-case-tag {
    font-family: ${MONO};
    font-size: 0.68rem;
    color: #F4A261;
    letter-spacing: 0.22em;
    position: relative;
    z-index: 1;
  }

  /* ── Hero ── */
  .s3-hero {
    min-height: 100svh;
    display: grid;
    grid-template-rows: 1fr auto;
    padding: clamp(1.5rem, 4vw, 4rem) clamp(1.5rem, 5vw, 4rem);
    padding-top: clamp(5rem, 10vw, 8rem);
    position: relative;
    touch-action: pan-y; /* ← garantisce scroll verticale touch su iOS */
  }
  .s3-hero-main {
    display: grid;
    grid-template-columns: 1fr;
    align-content: end;
    gap: 2rem;
    padding-bottom: 3rem;
  }
  /* H1 — impatto massimo: clamp aggressivo, tracking e leading serratissimi */
  .s3-hero-title {
    font-family: ${FONT};
    font-size: clamp(4rem, 14vw, 12rem);
    font-weight: 900;
    line-height: 0.85;
    letter-spacing: -0.05em;
    color: #F0E6D3;
    position: relative;
    text-shadow: 0 0 90px rgba(244,162,97,0.07);
  }
  .s3-hero-title-accent {
    color: transparent;
    -webkit-text-stroke: 1px rgba(240,230,211,0.32);
  }
  .s3-hero-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 1.5rem;
    border-top: 1px solid rgba(240,230,211,0.07);
    padding-top: 2rem;
  }
  /* HUD compartimentato: ROLE / CONTEXT / YEAR come celle di una spec-sheet */
  .s3-hero-meta-cols {
    display: flex;
    gap: 0;
    flex-wrap: wrap;
  }
  .s3-meta-col {
    position: relative;
    padding: 0.2rem clamp(1.3rem, 3vw, 2.4rem);
    border-left: 1px solid rgba(240,230,211,0.07);
    transition: background 0.35s ease;
  }
  .s3-meta-col:first-child { padding-left: clamp(0.6rem, 1.5vw, 1rem); }
  .s3-meta-col:hover { background: rgba(244,162,97,0.035); }
  /* tick di scansione HUD che si traccia in cima alla cella all'hover */
  .s3-meta-col::before {
    content: '';
    position: absolute;
    top: -1px; left: 0;
    width: 0; height: 1px;
    background: #F4A261;
    box-shadow: 0 0 10px rgba(244,162,97,0.7);
    transition: width 0.45s cubic-bezier(0.32,0.72,0,1);
  }
  .s3-meta-col:hover::before { width: 100%; }
  .s3-meta-col p:first-child {
    font-family: ${MONO};
    font-size: 0.65rem;
    color: rgba(240,230,211,0.35);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 0.3rem;
  }
  .s3-meta-col p:last-child {
    font-family: ${FONT};
    font-size: 0.95rem;
    color: #F0E6D3;
    font-weight: 600;
  }
  /* Status HUD (destra) con dot pulsante */
  .s3-hud-status {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-family: ${MONO};
    font-size: 0.65rem;
    color: rgba(240,230,211,0.4);
    letter-spacing: 0.12em;
  }
  .s3-hud-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #F4A261;
    box-shadow: 0 0 8px rgba(244,162,97,0.9);
    animation: s3-pulse 2.2s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes s3-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.3; transform: scale(0.7); }
  }
  .s3-tags {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .s3-tag {
    font-family: ${MONO};
    font-size: 0.58rem;
    color: #F4A261;
    border: 1px solid rgba(244,162,97,0.25);
    padding: 0.3rem 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    position: relative;
    transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.35s ease;
  }
  .s3-tag:hover {
    background: rgba(244,162,97,0.1);
    border-color: rgba(244,162,97,0.65);
    color: #F0E6D3;
    box-shadow: 0 0 18px rgba(244,162,97,0.25), inset 0 0 12px rgba(244,162,97,0.08);
  }

  /* ── Crosshair corners ── */
  .s3-crosshair {
    position: absolute;
    width: 20px;
    height: 20px;
    opacity: 0.25;
  }
  .s3-crosshair::before, .s3-crosshair::after {
    content: '';
    position: absolute;
    background: #F4A261;
  }
  .s3-crosshair::before { width: 1px; height: 100%; left: 50%; transform: translateX(-50%); }
  .s3-crosshair::after  { height: 1px; width: 100%; top: 50%; transform: translateY(-50%); }
  .s3-ch-tl { top: 1rem; left: 1rem; }
  .s3-ch-tr { top: 1rem; right: 1rem; }
  .s3-ch-bl { bottom: 1rem; left: 1rem; }
  .s3-ch-br { bottom: 1rem; right: 1rem; }

  /* ── Hero image curtain (NON TOCCARE: logica GSAP curtain/parallax) ── */
  .s3-image-reveal-wrap {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none; /* ← il layer immagine NON deve intercettare touch */
  }
  .s3-image-curtain {
    position: absolute;
    inset: 0;
    background: #020100;
    transform-origin: top;
    z-index: 2;
    pointer-events: none;
  }
  .s3-image-inner {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: contrast(1.1) brightness(0.85) saturate(0.9);
    transform: scale(1.08);
    display: block;
    pointer-events: none;
  }
  .s3-image-vignette {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(2,1,0,0.5) 0%,
      transparent 30%,
      transparent 70%,
      rgba(2,1,0,0.9) 100%
    );
    z-index: 1;
    pointer-events: none;
  }

  /* ── Overlay info sull'immagine ── */
  .s3-img-caption {
    position: absolute;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 3;
    font-family: ${MONO};
    font-size: 0.65rem;
    color: rgba(240,230,211,0.45);
    letter-spacing: 0.1em;
    text-align: right;
  }

  /* ═══════════════════════════════════════════════════
     OUTPUT / RENDER — "Gallery": l'immagine come artefatto
  ═══════════════════════════════════════════════════ */
  .s3-render {
    padding: 0 clamp(1.5rem, 5vw, 4rem);
    max-width: 920px;
    margin: 0 auto;
    margin-bottom: clamp(4rem, 8vw, 7rem);
  }
  .s3-render-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .s3-render-head-label {
    font-family: ${MONO};
    font-size: 0.65rem;
    color: #F4A261;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .s3-render-head-meta {
    font-family: ${MONO};
    font-size: 0.62rem;
    color: rgba(240,230,211,0.2);
    letter-spacing: 0.1em;
  }
  /* Frame tecnico: cornice "software GUI" attorno all'artefatto */
  .s3-render-frame {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: ${C.bg};
    border: 1px solid rgba(240,230,211,0.07);
  }
  .s3-render-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    filter: contrast(1.1) brightness(0.88) saturate(0.85);
  }
  .s3-render-vignette {
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 120px rgba(2,1,0,0.75);
    pointer-events: none;
    z-index: 2;
  }
  .s3-render-scan {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
    background-image: repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.06) 4px, rgba(0,0,0,0.06) 5px);
  }
  /* ::before → reticolo di mira al centro (pseudo-elemento, GUI) */
  .s3-render-frame::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    background:
      linear-gradient(rgba(244,162,97,0.3), rgba(244,162,97,0.3)) center / 1px 34px no-repeat,
      linear-gradient(rgba(244,162,97,0.3), rgba(244,162,97,0.3)) center / 34px 1px no-repeat;
  }
  /* ::after → etichetta di stato in alto a sinistra (pseudo-elemento, GUI) */
  .s3-render-frame::after {
    content: '◈ TARGET LOCK';
    position: absolute;
    top: 1rem; left: 1.2rem;
    z-index: 4;
    pointer-events: none;
    font-family: ${MONO};
    font-size: 0.58rem;
    letter-spacing: 0.16em;
    color: rgba(244,162,97,0.6);
  }
  /* Parentesi angolari (4 L-brackets) — telemetria d'angolo */
  .s3-corner {
    position: absolute;
    width: 22px; height: 22px;
    z-index: 4;
    pointer-events: none;
  }
  .s3-corner-tl { top: 0.8rem;  left: 0.8rem;  border-top: 1px solid rgba(244,162,97,0.55); border-left: 1px solid rgba(244,162,97,0.55); }
  .s3-corner-tr { top: 0.8rem;  right: 0.8rem; border-top: 1px solid rgba(244,162,97,0.55); border-right: 1px solid rgba(244,162,97,0.55); }
  .s3-corner-bl { bottom: 0.8rem; left: 0.8rem;  border-bottom: 1px solid rgba(244,162,97,0.55); border-left: 1px solid rgba(244,162,97,0.55); }
  .s3-corner-br { bottom: 0.8rem; right: 0.8rem; border-bottom: 1px solid rgba(244,162,97,0.55); border-right: 1px solid rgba(244,162,97,0.55); }
  .s3-render-readout {
    position: absolute;
    bottom: 1.2rem; right: 1.2rem;
    z-index: 4;
    pointer-events: none;
    font-family: ${MONO};
    font-size: 0.6rem;
    color: rgba(244,162,97,0.45);
    letter-spacing: 0.1em;
    text-align: right;
  }
  /* Spec sheet brutalista: griglia con linee 1px perfette (gap:1px su rail) */
  .s3-render-spec {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: rgba(240,230,211,0.07);
    border: 1px solid rgba(240,230,211,0.07);
    border-top: none;
  }
  .s3-spec-cell {
    background: ${C.bgDeep};
    padding: 0.9rem 1rem;
    font-family: ${MONO};
    transition: background 0.3s ease;
  }
  .s3-spec-cell:hover { background: #0a0604; }
  .s3-spec-k {
    font-size: 0.56rem;
    color: rgba(240,230,211,0.28);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 0.3rem;
  }
  .s3-spec-v {
    font-size: 0.8rem;
    color: #F0E6D3;
  }

  /* ── Sezione overview — contrasto editoriale esagerato ── */
  .s3-overview {
    padding: clamp(4rem, 8vw, 7rem) clamp(1.5rem, 5vw, 4rem);
    max-width: 1400px;
    margin: 0 auto;
  }
  .s3-overview-grid {
    display: grid;
    grid-template-columns: minmax(0,1fr) minmax(0,1fr);
    gap: clamp(3rem, 6vw, 7rem);
    align-items: start;
  }
  .s3-overview-label {
    font-family: ${MONO};
    font-size: 0.68rem;
    color: #F4A261;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin-bottom: 1.5rem;
  }
  /* H2 monumentale, da editoriale di lusso */
  .s3-overview-h2 {
    font-family: ${FONT};
    font-size: clamp(2.5rem, 6vw, 5rem);
    font-weight: 800;
    color: #F0E6D3;
    letter-spacing: -0.04em;
    line-height: 1.0;
  }
  .s3-overview-h2 em {
    font-style: normal;
    color: #F4A261;
  }
  /* Corpo: piccolo, leggibilissimo, larghezza ergonomica + riga 1px verticale */
  .s3-overview-body {
    border-left: 1px solid rgba(240,230,211,0.07);
    padding-left: clamp(2rem, 4vw, 4rem);
  }
  .s3-overview-body p {
    font-family: ${FONT};
    font-size: clamp(0.95rem, 1.2vw, 1.05rem);
    color: rgba(240,230,211,0.5);
    line-height: 1.8;
    margin-bottom: 1.5rem;
    max-width: 50ch;
  }
  .s3-overview-body p strong { color: #F0E6D3; font-weight: 700; }
  .s3-overview-body p:last-child { margin-bottom: 0; }

  /* ═══════════════════════════════════════════════════
     DEEP DIVE — Cards (IDE di lusso)
  ═══════════════════════════════════════════════════ */
  .s3-deep {
    padding: clamp(4rem, 8vw, 7rem) clamp(1.5rem, 5vw, 4rem);
    padding-bottom: clamp(4rem, 8vw, 7rem);
    max-width: 1400px;
    margin: 0 auto;
  }
  .s3-deep-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid rgba(240,230,211,0.07);
    padding-bottom: 1.5rem;
    margin-bottom: clamp(2.5rem, 5vw, 4rem);
    flex-wrap: wrap;
    gap: 1rem;
  }
  .s3-deep-label {
    font-family: ${MONO};
    font-size: 0.68rem;
    color: #F4A261;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }
  .s3-deep-counter {
    font-family: ${MONO};
    font-size: 0.65rem;
    color: rgba(240,230,211,0.25);
    letter-spacing: 0.1em;
  }

  /* Card completa: num + split info/code */
  .s3-feat-card {
    position: relative;
    display: grid;
    grid-template-columns: clamp(5rem, 8vw, 8.5rem) 1fr 1fr;
    grid-template-rows: auto;
    gap: 0;
    border: 1px solid rgba(240,230,211,0.07);
    background: rgba(255,255,255,0.01);
    margin-bottom: 1px; /* bordi adiacenti, gap visivo zero */
    transition: background 0.4s ease;
    overflow: hidden;
  }
  .s3-feat-card:hover {
    background: rgba(244,162,97,0.025);
  }
  /* Bordo sinistro luminoso che si traccia in altezza all'hover (sensuale) */
  .s3-feat-card::after {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 2px; height: 0;
    background: linear-gradient(180deg, #F4A261, #E9C46A);
    box-shadow: 0 0 18px rgba(244,162,97,0.6);
    transform-origin: top;
    transition: height 0.5s cubic-bezier(0.32,0.72,0,1);
    z-index: 5;
  }
  .s3-feat-card:hover::after { height: 100%; }

  /* Colonna numero (sinistra verticale) — numero GIGANTE, strutturale */
  .s3-feat-num-col {
    grid-row: 1;
    grid-column: 1;
    border-right: 1px solid rgba(240,230,211,0.07);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: clamp(1.5rem, 3vw, 2.5rem) 0;
  }
  .s3-feat-num {
    font-family: ${MONO};
    font-size: clamp(2.6rem, 5vw, 5.5rem);
    font-weight: 700;
    color: transparent;
    -webkit-text-stroke: 1.5px rgba(244,162,97,0.32);
    line-height: 1;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    letter-spacing: 0.05em;
    transition: color 0.45s ease, -webkit-text-stroke 0.45s ease, text-shadow 0.45s ease;
  }
  .s3-feat-card:hover .s3-feat-num {
    color: #F4A261;
    -webkit-text-stroke: 1.5px transparent;
    text-shadow: 0 0 45px rgba(244,162,97,0.5);
  }
  /* etichetta numero ridondante: nascosta su desktop, usata solo su mobile */
  .s3-feat-num-label { display: none; }

  /* Colonna testo (centro) */
  .s3-feat-text-col {
    grid-row: 1;
    grid-column: 2;
    min-width: 0;
    padding: clamp(1.5rem, 3vw, 2.5rem);
    border-right: 1px solid rgba(240,230,211,0.07);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1rem;
  }
  .s3-feat-title {
    font-family: ${FONT};
    font-size: clamp(1.1rem, 2vw, 1.55rem);
    font-weight: 800;
    color: #F0E6D3;
    letter-spacing: -0.02em;
    line-height: 1.15;
    transition: transform 0.5s cubic-bezier(0.32,0.72,0,1);
  }
  .s3-feat-desc {
    font-family: ${FONT};
    font-size: clamp(0.82rem, 1.2vw, 0.95rem);
    color: rgba(240,230,211,0.42);
    line-height: 1.7;
    transition: transform 0.5s cubic-bezier(0.32,0.72,0,1);
  }
  /* hover: il contenuto testuale scivola a destra (tensione cinetica) */
  .s3-feat-card:hover .s3-feat-title { transform: translateX(10px); }
  .s3-feat-card:hover .s3-feat-desc  { transform: translateX(10px); }

  /* Colonna codice (destra) — IDE di lusso su nero puro */
  .s3-feat-code-col {
    grid-row: 1;
    grid-column: 3;
    min-width: 0;
    background: #000;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .s3-feat-code-col::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, rgba(244,162,97,0.5), transparent 60%);
    z-index: 2;
  }
  /* Barra header stile terminale macOS: 3 dot + path file */
  .s3-code-header {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.7rem 1rem;
    border-bottom: 1px solid rgba(240,230,211,0.07);
    background: rgba(255,255,255,0.015);
  }
  .s3-code-dots { display: flex; gap: 0.4rem; }
  .s3-code-dot { width: 10px; height: 10px; border-radius: 50%; }
  .s3-dot-r { background: #FF5F56; }
  .s3-dot-y { background: #FFBD2E; }
  .s3-dot-g { background: #27C93F; }
  .s3-code-file {
    margin-left: auto;
    font-family: ${MONO};
    font-size: 0.62rem;
    color: rgba(240,230,211,0.4);
    letter-spacing: 0.06em;
  }
  .s3-code-body {
    padding: clamp(1.2rem, 2.5vw, 2rem);
    flex: 1;
  }
  .s3-feat-code-col pre {
    margin: 0;
    font-family: ${MONO};
    font-size: clamp(0.68rem, 1.1vw, 0.8rem);
    line-height: 1.75;
    overflow-x: auto;
    /*
      FIX 3 — overscroll-behavior-x: contain
      ────────────────────────────────────────────────────────────────
      Il <pre> è un contenitore con overflow-x:auto → su iOS Safari
      è un elemento scrollabile. Quando il dito inizia uno swipe
      orizzontale SOPRA il codice, iOS può "rubare" il gesto al
      documento per scrollare il <pre> e, raggiunto il bordo, fare
      un bounce. Questo freeze il page-scroll per l'intera gesture.
      contain: quando il <pre> raggiunge i suoi bordi, il gesto
      NON si propaga al documento. Zero bounce, zero freeze.
      ────────────────────────────────────────────────────────────────
    */
    overscroll-behavior-x: contain;
  }

  /* syntax — colori che spiccano sul nero puro */
  .s3-code-comment { color: rgba(240,230,211,0.3); font-style: italic; }
  .s3-code-kw  { color: #F4A261; }
  .s3-code-fn  { color: #E9C46A; }
  .s3-code-num { color: #66D9EF; }
  .s3-code-var { color: #F0E6D3; }
  .s3-code-op  { color: rgba(240,230,211,0.45); }

  /* ── MOBILE: deep-dive verticale, distinto ma tecnico ── */
  @media (max-width: 768px) {
    .s3-feat-card {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
    }
    .s3-feat-num-col {
      grid-column: 1;
      grid-row: 1;
      border-right: none;
      border-bottom: 1px solid rgba(240,230,211,0.07);
      padding: 1.2rem clamp(1.2rem, 4vw, 2rem);
      justify-content: flex-start;
      align-items: center;
      flex-direction: row;
      gap: 1rem;
    }
    .s3-feat-num {
      writing-mode: horizontal-tb;
      transform: none;
      font-size: 1.5rem;
      -webkit-text-stroke: 1px rgba(244,162,97,0.4);
    }
    .s3-feat-num-label {
      display: block;
      font-family: ${MONO};
      font-size: 0.65rem;
      color: rgba(244,162,97,0.5);
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .s3-feat-text-col {
      grid-column: 1;
      grid-row: 2;
      border-right: none;
      border-bottom: 1px solid rgba(240,230,211,0.07);
      padding: clamp(1.2rem, 4vw, 2rem);
    }
    /* su mobile lo slide-hover non ha senso (no cursore) → niente shift */
    .s3-feat-card:hover .s3-feat-title,
    .s3-feat-card:hover .s3-feat-desc { transform: none; }
    .s3-feat-code-col {
      grid-column: 1;
      grid-row: 3;
    }
    .s3-code-body { padding: clamp(1rem, 4vw, 1.5rem); }
    .s3-feat-code-col pre {
      font-size: 0.72rem;
    }
  }

  /* ── Sezione finale / CTA ── */
  .s3-footer-section {
    padding: clamp(4rem, 8vw, 7rem) clamp(1.5rem, 5vw, 4rem);
    max-width: 1400px;
    margin: 0 auto;
    border-top: 1px solid rgba(240,230,211,0.07);
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 2rem;
  }
  .s3-footer-text {
    font-family: ${FONT};
    font-size: clamp(0.85rem, 1.2vw, 1rem);
    color: rgba(240,230,211,0.3);
    max-width: 400px;
    line-height: 1.6;
  }
  .s3-footer-cta {
    font-family: ${MONO};
    font-size: 0.72rem;
    color: rgba(240,230,211,0.35);
    letter-spacing: 0.12em;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    transition: color 0.25s ease, gap 0.35s cubic-bezier(0.32,0.72,0,1);
  }
  .s3-footer-cta:hover { color: #F4A261; gap: 0.95rem; }

  /* ── RESPONSIVE GLOBALE ── */
  @media (max-width: 900px) {
    .s3-overview-grid {
      grid-template-columns: 1fr;
      gap: 2.5rem;
    }
    /* la riga 1px verticale diventa orizzontale sopra al corpo */
    .s3-overview-body {
      border-left: none;
      border-top: 1px solid rgba(240,230,211,0.07);
      padding-left: 0;
      padding-top: 2.5rem;
    }
    .s3-overview-body p { max-width: none; }
  }

  @media (max-width: 600px) {
    .s3-hero-title {
      font-size: clamp(3rem, 16vw, 5.5rem);
      letter-spacing: -0.045em;
    }
    .s3-hero-meta-cols { gap: 0; }
    .s3-meta-col { padding: 0.2rem clamp(0.9rem, 3vw, 1.4rem); }
    .s3-render-spec { grid-template-columns: repeat(2, 1fr); }
    .s3-render-frame::after { font-size: 0.52rem; }
    .s3-corner { width: 16px; height: 16px; }
  }
`;

/* ═══════════════════════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════════════════════ */
const FEATURES = [
  {
    num: '01',
    file: 'src/engine/projection.c',
    title: 'Proiezione Prospettica',
    desc: 'La conversione dallo spazio 3D allo schermo 2D avviene dividendo le coordinate X e Y per la distanza Z del punto. Questo ricrea fedelmente come la luce colpisce il cristallino dell\'occhio umano.',
    code: (
      <>
        <span className="s3-code-comment">{'// Prospettiva: più lontano = più piccolo'}</span>{'\n'}
        <span className="s3-code-kw">float</span> <span className="s3-code-var">zfactor</span> <span className="s3-code-op">=</span> <span className="s3-code-num">1</span> <span className="s3-code-op">+</span> <span className="s3-code-op">(</span><span className="s3-code-var">rotated</span>.<span className="s3-code-var">z</span> <span className="s3-code-op">/</span> <span className="s3-code-num">300</span><span className="s3-code-op">)</span>;<br />
        <span className="s3-code-kw">float</span> <span className="s3-code-var">x2d</span> <span className="s3-code-op">=</span> <span className="s3-code-var">rotated</span>.<span className="s3-code-var">x</span> <span className="s3-code-op">/</span> <span className="s3-code-var">zfactor</span>;<br />
        <span className="s3-code-kw">float</span> <span className="s3-code-var">y2d</span> <span className="s3-code-op">=</span> <span className="s3-code-var">rotated</span>.<span className="s3-code-var">y</span> <span className="s3-code-op">/</span> <span className="s3-code-var">zfactor</span>;
      </>
    ),
  },
  {
    num: '02',
    file: 'src/engine/fastmath.c',
    title: 'Fast Math & CPU Optimization',
    desc: 'Per mantenere i 60 FPS elaborando migliaia di punti via CPU, le funzioni trigonometriche vengono calcolate una singola volta per frame fuori dai cicli di render, eliminando colli di bottiglia matematici.',
    code: (
      <>
        <span className="s3-code-comment">{'// Calcolato UNA volta fuori dal loop'}</span>{'\n'}
        <span className="s3-code-kw">float</span> <span className="s3-code-var">sin_a</span> <span className="s3-code-op">=</span> <span className="s3-code-fn">sin</span><span className="s3-code-op">(</span><span className="s3-code-var">alpha</span><span className="s3-code-op">)</span>;<br />
        <span className="s3-code-kw">float</span> <span className="s3-code-var">cos_a</span> <span className="s3-code-op">=</span> <span className="s3-code-fn">cos</span><span className="s3-code-op">(</span><span className="s3-code-var">alpha</span><span className="s3-code-op">)</span>;<br />
        <span className="s3-code-comment">{'// Poi usato N volte dentro render_frame()'}</span>
      </>
    ),
  },
  {
    num: '03',
    file: 'src/engine/zdepth.c',
    title: 'Z-Depth Fading',
    desc: 'Per dare un reale senso di profondità, il colore di ogni singolo pixel viene moltiplicato in tempo reale per una frazione derivata dalla sua distanza (Asse Z), sfumandolo nel nero man mano che si allontana dalla camera.',
    code: (
      <>
        <span className="s3-code-comment">{'// Intensità basata sulla profondità Z'}</span>{'\n'}
        <span className="s3-code-kw">float</span> <span className="s3-code-var">intensity</span> <span className="s3-code-op">=</span> <span className="s3-code-num">1.2f</span> <span className="s3-code-op">/</span> <span className="s3-code-var">zfactor</span>;<br />
        <span className="s3-code-fn">draw_pixel</span><span className="s3-code-op">(</span><span className="s3-code-var">x</span>, <span className="s3-code-var">y</span>,<br />
        {'    '}<span className="s3-code-var">r</span> <span className="s3-code-op">*</span> <span className="s3-code-var">intensity</span>,<br />
        {'    '}<span className="s3-code-var">g</span> <span className="s3-code-op">*</span> <span className="s3-code-var">intensity</span><span className="s3-code-op">)</span>;
      </>
    ),
  },
];

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE
═══════════════════════════════════════════════════════════════ */
export default function Software3DEngine() {
  const pageRef    = useRef(null);
  const curtainRef = useRef(null);
  const imgRef     = useRef(null);

  // ✅ useLayoutEffect per lo scroll RIMOSSO:
  // ScrollToTop in App.jsx ci pensa già prima che questo componente monti.
  // Avere due hook che chiamano window.scrollTo() in sequenza causa
  // un flash di posizione sbagliata e può interrompere il ciclo di layout di GSAP.

  useEffect(() => {
    // ✅ scrollTimer RIMOSSO: era un workaround per il mancato ScrollToTop.
    // Ora che ScrollToTop gestisce il reset prima del mount, non serve
    // e il setTimeout ritardava l'avvio delle animazioni di 50ms inutilmente.

    // ✅ requestAnimationFrame garantisce che il browser abbia completato
    // almeno un ciclo di layout+paint prima che GSAP legga le classi CSS
    // (es. .s3-clip-inner con translateY:110%).
    // Senza questo, in certi casi GSAP legge lo stato "in-transition" del DOM
    // e le animazioni partono da valori sbagliati o non partono affatto.
    let rafId;
    const ctx = gsap.context(() => {
      rafId = requestAnimationFrame(() => {

        /* ── 1. Boot sequence: testi mascherati ── */
        gsap.to('.s3-clip-inner', {
          translateY: '0%',
          duration: 1.1,
          stagger: 0.1,
          ease: 'expo.out',
          delay: 0.15,
        });

        /* ── 2. Nav fade in ── */
        gsap.to('.s3-nav', {
          opacity: 1,
          duration: 1,
          delay: 0.5,
          ease: 'power2.out',
        });

        /* ── 3. Linee che si tracciano ── */
        gsap.to('.s3-line', {
          scaleX: 1,
          duration: 1.4,
          ease: 'expo.inOut',
          delay: 0.4,
          stagger: 0.1,
        });

        /* ── 4. Crosshairs ── */
        gsap.fromTo('.s3-crosshair',
          { opacity: 0, scale: 2 },
          { opacity: 0.25, scale: 1, duration: 1, delay: 0.8, stagger: 0.1, ease: 'expo.out' }
        );

        /* ── 5. Tags ── */
        gsap.fromTo('.s3-tag',
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, delay: 0.9, ease: 'power3.out' }
        );

        /* ── 6. Curtain reveal dell'immagine ── */
        gsap.to(curtainRef.current, {
          scaleY: 0,
          duration: 1.4,
          ease: 'expo.inOut',
          delay: 0.6,
          transformOrigin: 'top',
          onComplete: () => {
            /* ── 7. Parallax immagine — solo desktop, su mobile causa scroll lock ── */
            const isMobile = window.innerWidth < 768;
            if (imgRef.current && !isMobile) {
              ScrollTrigger.create({
                trigger: imgRef.current.closest('.s3-image-reveal-wrap'),
                start: 'top top',
                end: 'bottom top',
                scrub: 1.5,
                onUpdate: (self) => {
                  if (imgRef.current) {
                    gsap.set(imgRef.current, { y: self.progress * 60 });
                  }
                },
              });
            }
            /* Forza il ricalcolo di tutti i trigger dopo il reveal */
            ScrollTrigger.refresh();
          },
        });

        /* ── 8. Fade up scroll-triggered (overview & footer) ── */
        gsap.utils.toArray('.s3-scroll-fade').forEach((el) => {
          gsap.fromTo(el,
            { opacity: 0, y: 30 },
            {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: el,
                start: 'top 90%',
                toggleActions: 'play none none none',
                once: true,
              },
            }
          );
        });

        /* ── 9. Linee orizzontali animate allo scroll ── */
        gsap.utils.toArray('.s3-scroll-line').forEach((el) => {
          gsap.fromTo(el,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 1.2,
              ease: 'expo.inOut',
              transformOrigin: 'left',
              scrollTrigger: {
                trigger: el,
                start: 'top 85%',
              },
            }
          );
        });

      }); // end rAF
    }, pageRef);

    return () => {
      cancelAnimationFrame(rafId);
      ctx.revert(); // ✅ Pulisce SOLO i trigger di questa pagina, non quelli globali
    };
  }, []);


  return (
    <div ref={pageRef} style={{ background: C.bgDeep, minHeight: '100svh', color: C.text }}>
      <style>{CSS}</style>

      {/* ══ GRAIN OVERLAY (fisso, pointer-events:none) ══ */}
      <div className="s3-grain" aria-hidden="true" />

      {/* ══ NAV ══ */}
      <header className="s3-nav">
        <Link to="/" state={{ scrollToWorks: true }} className="s3-back-link">
          <span>←</span> BACK TO INDEX
        </Link>
        <span className="s3-case-tag">[ CASE STUDY // 05 ]</span>
      </header>

      {/* ══ HERO ══ */}
      <section className="s3-hero">
        {/* Crosshair ai 4 angoli */}
        <div className="s3-crosshair s3-ch-tl" />
        <div className="s3-crosshair s3-ch-tr" />
        <div className="s3-crosshair s3-ch-bl" />
        <div className="s3-crosshair s3-ch-br" />

        {/* Immagine con curtain reveal + parallax (LOGICA INVARIATA) */}
        <div className="s3-image-reveal-wrap">
          <div className="s3-image-curtain" ref={curtainRef} />
          <video
            ref={imgRef}
            className="s3-image-inner"
            autoPlay
            loop
            muted
            playsInline
            poster="/images/immagine3D.png"
          >
            <source src="/images/video3D.mp4" type="video/mp4" />
            Il tuo browser non supporta il tag video.
          </video>
          <div className="s3-image-vignette" />
          <div className="s3-img-caption">
            SOFTWARE RENDER // CPU-ONLY // SDL2 FRAMEBUFFER
          </div>
        </div>

        {/* Contenuto hero sopra l'immagine — pointer-events esplicito */}
        <div className="s3-hero-main" style={{ position: 'relative', zIndex: 2, pointerEvents: 'auto' }}>
          {/* Tags */}
          <div className="s3-tags">
            {['C', 'SDL2', '3D Math', 'Software Rendering'].map(tag => (
              <span key={tag} className="s3-tag">{tag}</span>
            ))}
          </div>

          {/* Titolo — clip mask reveal (STRUTTURA INVARIATA) */}
          <h1 className="s3-hero-title" aria-label="Software 3D Engine">
            <span className="s3-clip-wrap" style={{ display: 'block' }}>
              <span className="s3-clip-inner" style={{ display: 'block' }}>Software</span>
            </span>
            <span className="s3-clip-wrap" style={{ display: 'block' }}>
              <span className="s3-clip-inner" style={{ display: 'block' }}>
                3D{' '}
                <span className="s3-hero-title-accent">Engine.</span>
              </span>
            </span>
          </h1>

          {/* Meta row — HUD tabulare */}
          <div>
            <div className="s3-line" style={{ height: '1px', background: C.rail, width: '100%', marginBottom: '2rem' }} />
            <div className="s3-hero-meta-row">
              <div className="s3-hero-meta-cols">
                {[
                  ['ROLE', 'Systems Programmer'],
                  ['CONTEXT', 'Computer Graphics Lab'],
                  ['YEAR', '2026'],
                ].map(([label, val]) => (
                  <div className="s3-meta-col" key={label}>
                    <span className="s3-clip-wrap"><span className="s3-clip-inner"><p>{label}</p></span></span>
                    <span className="s3-clip-wrap"><span className="s3-clip-inner"><p>{val}</p></span></span>
                  </div>
                ))}
              </div>
              <div className="s3-hud-status">
                <span className="s3-hud-dot" aria-hidden="true" />
                <span className="s3-clip-wrap"><span className="s3-clip-inner">CPU-ONLY · NO GPU</span></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ SEZIONE IMMAGINE RENDER — Artefatto ══ */}
      <section className="s3-render">
        <div className="s3-scroll-fade">
          {/* Label */}
          <div className="s3-render-head">
            <span className="s3-render-head-label">[ OUTPUT // RENDER FINALE ]</span>
            <span className="s3-render-head-meta">SOFTWARE RENDERER · CPU-ONLY · SDL2 FRAMEBUFFER</span>
          </div>

          {/* Frame tecnico: reticolo (::before), label TARGET LOCK (::after),
              4 parentesi angolari, vignette, scanline e readout di telemetria */}
          <div className="s3-render-frame">
            <img
              className="s3-render-img"
              src="/images/immagine3D.avif"
              alt="3D Engine Software Render Output"
            />
            <div className="s3-render-vignette" aria-hidden="true" />
            <div className="s3-render-scan" aria-hidden="true" />
            <span className="s3-corner s3-corner-tl" aria-hidden="true" />
            <span className="s3-corner s3-corner-tr" aria-hidden="true" />
            <span className="s3-corner s3-corner-bl" aria-hidden="true" />
            <span className="s3-corner s3-corner-br" aria-hidden="true" />
            <div className="s3-render-readout">
              WIREFRAME CUBE · ROTATION MATRIX · Z-BUFFER<br />
              <span style={{ color: 'rgba(240,230,211,0.25)' }}>60 FPS · NO GPU ACCELERATION</span>
            </div>
          </div>

          {/* Spec sheet brutalista: griglia 1px da datasheet d'ingegneria */}
          <div className="s3-render-spec">
            {[
              ['RENDERER', 'Software / CPU'],
              ['PRIMITIVI', 'Wireframe 3D'],
              ['OUTPUT', 'SDL2 Framebuffer'],
              ['FPS TARGET', '60 fps'],
            ].map(([k, v]) => (
              <div className="s3-spec-cell" key={k}>
                <div className="s3-spec-k">{k}</div>
                <div className="s3-spec-v">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ OVERVIEW ══ */}
      <section className="s3-overview">
        <div className="s3-overview-grid s3-scroll-fade">
          {/* Colonna sinistra — titolo editoriale */}
          <div>
            <p className="s3-overview-label">[ OVERVIEW ]</p>
            <h2 className="s3-overview-h2">
              L'arte di non usare<br />
              <em>librerie pre-confezionate.</em>
            </h2>
          </div>

          {/* Colonna destra — corpo (divisa da riga 1px verticale) */}
          <div className="s3-overview-body">
            <p>
              Nel web moderno è facile affidarsi a librerie come Three.js o WebGL per renderizzare oggetti 3D. Ma cosa succede se togliamo il browser, togliamo la scheda video e chiediamo al processore (CPU) di calcolare ogni singolo pixel a mano?
            </p>
            <p>
              Questo progetto è un motore di rendering software scritto in <strong>C puro</strong>. Utilizza SDL2 esclusivamente per aprire una finestra e ottenere un framebuffer vuoto. Tutta la matematica della telecamera, le proiezioni prospettiche, le rotazioni matriciali e lo Z-Depth fading sono scritti interamente da zero.
            </p>
          </div>
        </div>

        {/* Separatore scroll-animato */}
        <div className="s3-scroll-line" style={{ height: '1px', background: C.rail, marginTop: '4rem', transformOrigin: 'left' }} />
      </section>

      {/* ══ DEEP DIVE — CARDS ══ */}
      <section className="s3-deep">
        <div className="s3-deep-header s3-scroll-fade">
          <span className="s3-deep-label">[ ARCHITECTURE DEEP DIVE ]</span>
          <span className="s3-deep-counter">03 SISTEMI CORE</span>
        </div>

        <div className="s3-scroll-fade">
          {FEATURES.map((feat) => (
            <div key={feat.num} className="s3-feat-card">

              {/* Colonna numero — gigante e strutturale */}
              <div className="s3-feat-num-col">
                <span className="s3-feat-num">{feat.num}</span>
                <span className="s3-feat-num-label">{feat.num}</span>
              </div>

              {/* Colonna testo */}
              <div className="s3-feat-text-col">
                <div className="s3-feat-title">{feat.title}</div>
                <p className="s3-feat-desc">{feat.desc}</p>
              </div>

              {/* Colonna codice — IDE di lusso con header terminale */}
              <div className="s3-feat-code-col">
                <div className="s3-code-header">
                  <div className="s3-code-dots">
                    <span className="s3-code-dot s3-dot-r" />
                    <span className="s3-code-dot s3-dot-y" />
                    <span className="s3-code-dot s3-dot-g" />
                  </div>
                  <span className="s3-code-file">{feat.file}</span>
                </div>
                <div className="s3-code-body">
                  <pre><code>{feat.code}</code></pre>
                </div>
              </div>

            </div>
          ))}
        </div>

        <div className="s3-scroll-line" style={{ height: '1px', background: C.rail, marginTop: '5rem', transformOrigin: 'left' }} />
      </section>

      {/* ══ FOOTER / NEXT ══ */}
      <section className="s3-footer-section s3-scroll-fade">
        <p className="s3-footer-text">
          Motore sviluppato come studio di grafica computazionale. Ogni pixel calcolato dalla CPU — nessuna delega alla GPU, nessuna libreria esterna.
        </p>
        <Link to="/" state={{ scrollToWorks: true }} className="s3-footer-cta">
          <span style={{ color: C.accent }}>←</span> TORNA AL PORTFOLIO
        </Link>
      </section>

    </div>
  );
}