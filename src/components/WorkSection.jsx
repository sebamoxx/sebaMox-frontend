import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useTransitionNavigate } from '../components/TransitionController';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/* ════════════════════════════════════════════════════════════════════
   WORK SECTION — "THE X-RAY CINEMATIC PORTAL" — rev. mobile-bulletproof
   ────────────────────────────────────────────────────────────────────
   Concept  : la Homepage nasconde un video dei lavori dietro un muro
              nero con tipografia monumentale. Il cursore è una lente
              a raggi X: buca il muro e rivela il video in un cerchio
              perfetto. Dentro la lente la scritta passa da piena a
              outline — la radiografia del portfolio. Sull'hover della
              CTA centrale la lente "snappa" al centro e si espande
              fino a rivelare l'intero video; il click apre /works.

   Tecnica  : DUE layer sovrapposti perfettamente identici nel layout:
              - BASE  (sotto): <video> + scritta in outline (stroke)
              - VEIL  (sopra): nero OLED + scritta piena bone
              Il VEIL ha una mask-image: radial-gradient ancorata a
              tre CSS custom properties (--mx, --my, --r). Il buco
              nella maschera È la lente.

   60fps    : il mouse NON tocca mai React. Un proxy {x,y,r} viene
              tweenato da gsap.quickTo (smorzamento power3 → la lente
              "insegue" il cursore con peso fisico) e ogni update
              scrive le CSS vars via gsap.quickSetter. Zero setState,
              zero re-render, zero layout thrashing: solo compositing.

   Mobile   : niente hover → la lente vive di vita propria, orbitando
              in una traiettoria di Lissajous attorno al centro con
              raggio che respira. Il giroscopio è stato scartato di
              proposito: su iOS richiede un permission-prompt invasivo.

   Battery  : IntersectionObserver mette in play/pause il video a
              seconda della visibilità della sezione. Con prefers-
              reduced-motion il video resta fermo e la lente statica.
════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — coerenti con preloader e archivio
═══════════════════════════════════════════════════════════════ */
const T = {
  void:      '#050505',
  bone:      '#E8E3D8',
  boneDim:   'rgba(232,227,216,0.45)',
  boneGhost: 'rgba(232,227,216,0.14)',
  hairline:  'rgba(232,227,216,0.08)',
  amber:     '#D89C4A',
  amberDim:  'rgba(216,156,74,0.40)',
};
const MONO = "'JetBrains Mono','IBM Plex Mono','ui-monospace','SFMono-Regular',Menlo,monospace";
const SANS = "'Outfit', system-ui, sans-serif";
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/* ═══════════════════════════════════════════════════════════════
   GIANT WORD — renderizzata DUE volte (base outline / veil piena).
   I due markup devono essere identici al pixel: stesso wrapper,
   stessa classe .xr-word (così il parallasse ScrollTrigger li
   muove all'unisono e la radiografia resta perfettamente allineata).
═══════════════════════════════════════════════════════════════ */
function GiantWord({ outline }) {
  return (
    <div className="xr-word-track" aria-hidden={outline ? true : undefined}>
      <h2
        className="xr-word"
        style={
          outline
            ? { color: 'transparent', WebkitTextStroke: `1px ${T.boneDim}` }
            : { color: T.bone }
        }
      >
        WORKS
      </h2>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
   props:
   - videoSrc : percorso del montaggio .mp4 (incolla qui il tuo)
   - poster   : frame statico opzionale (consigliato: primo frame)
═══════════════════════════════════════════════════════════════ */
export default function WorkSection({
  videoSrc = '/videos/works_reel4.0.mp4',
  poster   = '',
}) {
  const sectionRef = useRef(null);
  const veilRef    = useRef(null);
  const videoRef   = useRef(null);
  const ctaRef     = useRef(null);
  const tNavigate = useTransitionNavigate();

  useEffect(() => {
    const section = sectionRef.current;
    const veil    = veilRef.current;
    const video   = videoRef.current;
    const cta     = ctaRef.current;
    if (!section || !veil) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canHover      = window.matchMedia('(hover: hover) and (pointer: fine)').matches;


    const gsapCtx = gsap.context(() => {

      /* ── SETTER AD ALTA FREQUENZA ──────────────────────────────
         pos è un proxy plain-object: quickTo lo tweena, e a ogni
         update i quickSetter scrivono le CSS vars sul veil.
         React non viene MAI toccato durante il movimento.        */
      const setMx = gsap.quickSetter(veil, '--mx', 'px');
      const setMy = gsap.quickSetter(veil, '--my', 'px');
      const setR  = gsap.quickSetter(veil, '--r',  'px');

      const pos   = { x: 0, y: 0, r: 0 };
      const apply = () => { setMx(pos.x); setMy(pos.y); setR(pos.r); };

      /* Smorzamento "fisico": la lente insegue il cursore con peso.
         x/y veloci e reattivi; il raggio respira più lento.       */
      const xTo = gsap.quickTo(pos, 'x', { duration: 0.50, ease: 'power3.out', onUpdate: apply });
      const yTo = gsap.quickTo(pos, 'y', { duration: 0.50, ease: 'power3.out', onUpdate: apply });
      const rTo = gsap.quickTo(pos, 'r', { duration: 0.65, ease: 'power3.out', onUpdate: apply });

      /* ── GEOMETRIA (cache — niente letture DOM nel hot path) ──
         ⚠️ Misurata sulla SECTION, non su window: la maschera vive
         nelle coordinate del veil (= della section). Se la section
         è più alta del viewport, usare window decentra la lente.  */
      let W = section.offsetWidth  || window.innerWidth;
      let H = section.offsetHeight || window.innerHeight;
      let LENS_R  = Math.min(W, H) * 0.22;            // raggio lente
      let COVER_R = Math.hypot(W, H) * 0.75;          // raggio full-reveal
      const measure = () => {
        W = section.offsetWidth  || window.innerWidth;
        H = section.offsetHeight || window.innerHeight;
        LENS_R  = Math.min(W, H) * 0.22;
        COVER_R = Math.hypot(W, H) * 0.75;
      };

      /* Posizione iniziale: lente chiusa al centro */
      pos.x = W / 2; pos.y = H / 2; pos.r = 0;
      apply();

      /* ── PARALLASSE della scritta gigante (entrambi i layer) ──
         Stesso tween sui due .xr-word → allineamento garantito.  */
      gsap.to('.xr-word', {
        xPercent: -12,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });

      /* ── ENTRY ANIMATION — heavy fade-up degli elementi HUD ─── */
      if (!reducedMotion) {
        gsap.fromTo('.xr-rise',
          { y: 28, opacity: 0 },
          {
            y: 0, opacity: 1,
            duration: 1.1,
            stagger: 0.12,
            ease: 'expo.out',
            force3D: true,
            scrollTrigger: { trigger: section, start: 'top 65%', once: true },
          }
        );
      }

      /* ════ DESKTOP: la lente segue il cursore ════════════════ */
      let onMove, onEnter, onLeave, onCtaEnter, onCtaLeave;
      if (canHover && !reducedMotion) {
        let ctaLocked = false; // true mentre la CTA tiene la lente al centro

        onMove = (e) => {
          if (ctaLocked) return;
          const b = section.getBoundingClientRect();
          xTo(e.clientX - b.left);
          yTo(e.clientY - b.top);
        };
        onEnter = () => { if (!ctaLocked) rTo(LENS_R); };
        onLeave = () => { if (!ctaLocked) rTo(0); };

        /* MAGNETISMO CTA: la lente snappa al centro e divora il muro */
        onCtaEnter = () => {
          ctaLocked = true;
          const b = section.getBoundingClientRect();
          xTo(W / 2);
          yTo(Math.min(H, b.height) / 2);
          rTo(COVER_R);
        };
        onCtaLeave = () => {
          ctaLocked = false;
          rTo(LENS_R); // torna lente: il prossimo mousemove la riaggancia
        };

        section.addEventListener('pointermove',  onMove,  { passive: true });
        section.addEventListener('pointerenter', onEnter, { passive: true });
        section.addEventListener('pointerleave', onLeave, { passive: true });
        cta?.addEventListener('pointerenter', onCtaEnter, { passive: true });
        cta?.addEventListener('pointerleave', onCtaLeave, { passive: true });
      }

      /* ════ MOBILE: lente autonoma + FULL-REVEAL al tap ═══════
         Stato idle: la lente orbita da sola (Lissajous) col raggio
         che respira. TAP SULLO SFONDO → la lente snappa al centro
         e divora il muro: video intero, come l'hover CTA desktop.
         Secondo tap → il muro si richiude e l'orbita riprende.
         Il tap sulla CTA resta navigazione pura verso /works.    */
      let drift = null, onTap = null, collapseReveal = null;
      if (!canHover && !reducedMotion) {
        let revealed = false;
        gsap.delayedCall(0.6, () => rTo(LENS_R * 1.15));

        drift = () => {
          if (revealed) return; // lente parcheggiata durante il full-reveal
          const t = gsap.ticker.time;
          pos.x = W / 2 + Math.sin(t * 0.45)        * W * 0.20;
          pos.y = H / 2 + Math.sin(t * 0.72 + 1.3)  * H * 0.13;
          apply(); // il raggio è gestito dal tween "respiro" qui sotto
        };
        gsap.ticker.add(drift);

        // Respiro del raggio: pulsazione lenta ±12%
        const breath = gsap.to(pos, {
          r: LENS_R * 1.4,
          duration: 2.6,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          onUpdate: apply,
          delay: 1.2,
        });

        collapseReveal = () => {
          if (!revealed) return;
          revealed = false;
          gsap.killTweensOf(pos, 'x,y'); // il drift riprende il controllo
          breath.resume();
          rTo(LENS_R * 1.15);
        };

        onTap = (e) => {
          // La CTA mantiene il suo ruolo: tap = naviga, niente toggle
          if (e.target.closest && e.target.closest('.xr-cta')) return;
          if (revealed) { collapseReveal(); return; }
          revealed = true;
          breath.pause();
          xTo(W / 2);
          yTo(H / 2);
          rTo(COVER_R);
        };
        section.addEventListener('click', onTap, { passive: true });
      }

      /* ════ REDUCED MOTION: radiografia statica al centro ═════ */
      if (reducedMotion) {
        pos.x = W / 2; pos.y = H / 2; pos.r = Math.min(W, H) * 0.26;
        apply();
      }

      /* ── VIDEO: play solo quando la sezione è visibile ───────
         (batteria mobile + decoder GPU liberato fuori viewport) */
      let io = null;
      if (video && !reducedMotion) {
        io = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
            // Se l'utente scrolla via col muro spalancato, richiudilo:
            // al ritorno trova lo stato idle coerente (lente in orbita)
            collapseReveal?.();
          }
        }, { threshold: 0.15 });
        io.observe(section);
      }

      /* ── RESIZE: rimisura la geometria (width-only guard) ──── */
      let prevW = window.innerWidth;
      let rTimer = 0;
      const onResize = () => {
        if (Math.abs(window.innerWidth - prevW) <= 30) return;
        clearTimeout(rTimer);
        rTimer = setTimeout(() => { prevW = window.innerWidth; measure(); }, 200);
      };
      window.addEventListener('resize', onResize, { passive: true });

      /* ── CLEANUP interno al context ──────────────────────────── */
      return () => {
        if (onMove) {
          section.removeEventListener('pointermove',  onMove);
          section.removeEventListener('pointerenter', onEnter);
          section.removeEventListener('pointerleave', onLeave);
          cta?.removeEventListener('pointerenter', onCtaEnter);
          cta?.removeEventListener('pointerleave', onCtaLeave);
        }
        if (drift) gsap.ticker.remove(drift);
        if (onTap) section.removeEventListener('click', onTap);
        if (io) io.disconnect();
        clearTimeout(rTimer);
        window.removeEventListener('resize', onResize);
        video?.pause();
      };
    }, section);

    /* revert() uccide quickTo, tween infiniti, ScrollTrigger e set */
    return () => {
      gsapCtx.revert();
    };
  }, []);

  return (
    <section
      id="sezione-lavori"
      ref={sectionRef}
      className="xr-section"
      style={{
        /* ⚠️ NIENTE min-height inline: gli stili inline battono il
           blocco <style>, impedendo l'override 100dvh su mobile.
           Tutta la catena di altezze vive in .xr-section (CSS).  */
        position: 'relative',
        width: '100%',
        background: T.void,
        overflow: 'hidden',
        borderTop: `1px solid ${T.hairline}`,
        borderBottom: `1px solid ${T.hairline}`,
        fontFamily: MONO,
      }}
    >
      {/* ═══ LAYER BASE — il mondo dietro il muro ═══════════════
          Video + scritta outline. Visibile SOLO dentro la lente. */}
      <div className="xr-base" aria-hidden>
        <video
          ref={videoRef}
          className="xr-video"
          src={videoSrc}
          poster={poster || undefined}
          muted
          loop
          playsInline
          preload="metadata"
        />
        {/* Scrim: tiene leggibile l'outline sopra il video */}
        <div className="xr-scrim" />
        <GiantWord outline />
        {/* Crosshair ambra: dentro la lente il mondo è "strumentato" */}
        <div className="xr-reticle">
          <span>+</span><span>+</span><span>+</span><span>+</span>
        </div>
      </div>

      {/* ═══ LAYER VEIL — il muro nero radiografato ═════════════
          Maschera radiale ancorata a --mx / --my / --r.          */}
      <div ref={veilRef} className="xr-veil">
        <GiantWord />
      </div>

      {/* ═══ HUD — sopra la maschera, sempre leggibile ══════════ */}
      <div className="xr-hud">
        <p className="xr-eyebrow xr-rise">
          <span className="xr-dash" />
          ESPLORA L&apos;ARCHIVIO PROTETTO
          <span className="xr-dash" />
        </p>

        {/* CTA — il punto magnetico che spalanca il portale.
            <Link> di React Router: routing client-side, zero reload. */}
        <Link 
          to="/works" 
          ref={ctaRef} 
          className="xr-cta xr-rise"
          onClick={(e) => { e.preventDefault(); tNavigate('/works'); }}
        >

          <span className="xr-cta-labels">
            <span className="xr-lbl xr-lbl-a">ACCESS ARCHIVE</span>
            <span className="xr-lbl xr-lbl-b">[ INITIATE UPLINK ]</span>
          </span>
          <span className="xr-cta-orb" aria-hidden>↗</span>
        </Link>

        <p className="xr-taphint xr-rise" aria-hidden>TAP SULLO SFONDO PER RIVELARE IL REEL</p>
        <p className="xr-scrollhint xr-rise">OPPURE CONTINUA A SCORRERE</p>
      </div>

      <style>{`
        /* ═══ ALTEZZA — STRATEGIA BIFORCATA ══════════════════════
           DESKTOP (≥768px): esperienza full-screen. Catena di
           fallback (l'ultima supportata vince):
           1. 100vh → 2. --real-vh (iOS<15.4) → 3. 100svh → 4. 100svh

           MOBILE (<768px): NIENTE altezza forzata del viewport —
           la sezione è alta quanto il suo contenuto (scritta +
           HUD + padding). Era questo a creare la "striscia" con
           il nero vuoto attorno: il contenuto compatto galleggiava
           in un contenitore gonfiato a tutto schermo.            */
        .xr-section {
          display: flex;
          flex-direction: column;
        }
        @media (min-width: 768px) {
          .xr-section { min-height: 100svh; }
          @supports not (height: 1svh) {
            .xr-section { min-height: var(--real-vh, 100svh); }
          }
          @supports (min-height: 100svh) {
            .xr-section { min-height: 100svh; }
          }
          @supports (min-height: 100svh) {
            .xr-section { min-height: 100svh; }
          }
        }

        /* ═══ LAYOUT DEI DUE LAYER (identici al pixel) ═══════════
           inset:0 + width/height espliciti: copertura garantita
           del 100% della section su ogni formato — zero strisce. */
        .xr-base, .xr-veil {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        .xr-base { z-index: 1; }

        .xr-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center; /* niente zone vuote su 9:21 o 4:3 */
          /* il video non genera mai CLS: è absolute dentro la sezione */
        }
        .xr-scrim {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 50%, rgba(5,5,5,0.15) 0%, rgba(5,5,5,0.55) 100%);
          pointer-events: none;
        }

        /* ═══ IL MURO RADIOGRAFATO ═══════════════════════════════
           Il buco È la maschera: trasparente al centro (rivela il
           layer base), pieno fuori. Bordo feathered al 18% finale.
           translateZ(0) isola il veil su un layer composito.      */
        .xr-veil {
          z-index: 2;
          background: ${T.void};
          --mx: 50%;
          --my: 50%;
          --r: 0px;
          -webkit-mask-image: radial-gradient(
            circle at var(--mx) var(--my),
            transparent calc(var(--r) * 0.82),
            rgba(0,0,0,0.55) calc(var(--r) * 0.94),
            #000 var(--r)
          );
          mask-image: radial-gradient(
            circle at var(--mx) var(--my),
            transparent calc(var(--r) * 0.82),
            rgba(0,0,0,0.55) calc(var(--r) * 0.94),
            #000 var(--r)
          );
          transform: translateZ(0);
          will-change: mask-image, -webkit-mask-image;
        }

        /* ═══ TIPOGRAFIA MONUMENTALE ═════════════════════════════
           Bleeding oltre i bordi come un timbro — il muro È testo. */
        .xr-word-track {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 160vw;
          display: flex;
          justify-content: center;
          pointer-events: none;
          user-select: none;
        }
        .xr-word {
          margin: 0;
          font-family: ${SANS};
          font-size: clamp(9rem, 33vw, 42rem);
          font-weight: 800;
          line-height: 0.82;
          letter-spacing: -0.05em;
          white-space: nowrap;
          will-change: transform; /* parallasse ScrollTrigger */
        }

        /* ═══ RETICOLO dentro la lente ═══════════════════════════ */
        .xr-reticle span {
          position: absolute;
          font-family: ${MONO};
          font-size: 0.8rem;
          color: ${T.amberDim};
          line-height: 1;
        }
        .xr-reticle span:nth-child(1) { top: 18%;    left: 14%;  }
        .xr-reticle span:nth-child(2) { top: 22%;    right: 12%; }
        .xr-reticle span:nth-child(3) { bottom: 20%; left: 10%;  }
        .xr-reticle span:nth-child(4) { bottom: 16%; right: 16%; }

        /* ═══ HUD CENTRALE ═══════════════════════════════════════ */
        .xr-hud {
          position: relative;
          z-index: 10;
          /* flex:1 dentro la section flex-column → occupa SEMPRE
             il 100% dell'altezza reale, senza min-height proprie
             che possano andare in conflitto col viewport dinamico */
          flex: 1 1 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(2rem, 6svh, 3.4rem);
          padding: clamp(4rem, 10svh, 6rem) clamp(0.85rem, 4vw, 3rem);
          box-sizing: border-box;
          pointer-events: none; /* riattivati solo sulla CTA */
        }

        .xr-eyebrow {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: clamp(0.52rem, 1.1vw, 0.64rem);
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: ${T.boneDim};
          text-align: center;
        }
        .xr-dash {
          display: inline-block;
          width: 28px;
          height: 1px;
          background: ${T.boneGhost};
        }

        /* ═══ CTA — pill con label morphing e orb nested ═════════ */
        .xr-cta {
          pointer-events: auto;
          display: inline-flex;
          align-items: center;
          gap: 0.9rem;
          padding: 0.85rem 0.85rem 0.85rem 1.6rem;
          border-radius: 999px;
          border: 1px solid ${T.boneGhost};
          background: rgba(5,5,5,0.55);
          color: ${T.bone};
          text-decoration: none;
          font-family: ${MONO};
          font-size: clamp(0.6rem, 1.3vw, 0.72rem);
          letter-spacing: 0.26em;
          text-transform: uppercase;
          transition: border-color 0.7s ${EASE}, background 0.7s ${EASE},
                      transform 0.4s ${EASE};
        }
        .xr-cta:hover  { border-color: ${T.amberDim}; background: rgba(5,5,5,0.75); }
        .xr-cta:active { transform: scale(0.98); }

        /* Label morph: due scritte impilate dentro una maschera */
        .xr-cta-labels {
          position: relative;
          display: inline-block;
          overflow: hidden;
          height: 1.2em;
        }
        .xr-lbl {
          display: block;
          line-height: 1.2em;
          transition: transform 0.65s ${EASE}, opacity 0.65s ${EASE};
        }
        .xr-lbl-b {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translate(-50%, 120%);
          width: max-content;
          color: ${T.amber};
          opacity: 0;
        }
        .xr-cta:hover .xr-lbl-a { transform: translateY(-120%); opacity: 0; }
        .xr-cta:hover .xr-lbl-b { transform: translate(-50%, 0); opacity: 1; }

        /* Orb nested — button-in-button */
        .xr-cta-orb {
          width: 2.1rem;
          height: 2.1rem;
          border-radius: 999px;
          background: rgba(232,227,216,0.08);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          color: ${T.amber};
          transition: transform 0.65s ${EASE}, background 0.65s ${EASE};
        }
        .xr-cta:hover .xr-cta-orb {
          transform: translate(2px, -2px) scale(1.08);
          background: rgba(216,156,74,0.18);
        }

        .xr-scrollhint {
          margin: 0;
          font-size: clamp(0.46rem, 0.9vw, 0.56rem);
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: ${T.boneGhost};
          animation: xrHint 2.8s ${EASE} infinite;
        }
        @keyframes xrHint { 0%,100%{opacity:0.85} 50%{opacity:0.3} }

        /* Hint touch: visibile solo su mobile (vedi media query) */
        .xr-taphint {
          display: none;
          margin: 0;
          font-size: 0.5rem;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: ${T.amberDim};
        }

        /* ═══ MOBILE (<768px) ════════════════════════════════════
           - Sezione alta quanto il contenuto: l'HUD detta l'altezza
             col suo padding; scritta e video (absolute) riempiono
             esattamente quell'area. Zero nero vuoto.
           - Full-reveal touch: tap sullo sfondo → muro spalancato
             (gestito in JS); tap sulla CTA → navigazione /works. */
        @media (max-width: 767px) {
          .xr-section { min-height: 0; }
          .xr-taphint { display: block; }
          .xr-hud {
            flex: 0 0 auto; /* niente espansione forzata: è il contenuto a dettare l'altezza */
            padding: clamp(3.5rem, 14vw, 5rem) 1rem;
            gap: 1.5rem;
          }
          .xr-word { font-size: clamp(6rem, 38vw, 12rem); }
          .xr-eyebrow { letter-spacing: 0.22em; }
          .xr-dash { width: 18px; }
        }

        /* ═══ REDUCED MOTION ═════════════════════════════════════ */
        @media (prefers-reduced-motion: reduce) {
          .xr-scrollhint { animation: none; }
          .xr-lbl, .xr-cta, .xr-cta-orb { transition: none; }
          .xr-word { will-change: auto; }
        }
      `}</style>
    </section>
  );
}