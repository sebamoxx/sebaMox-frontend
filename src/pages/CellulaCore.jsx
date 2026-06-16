/**
 * CellulaCore.jsx — "LIVING CORE" / Spline WebGL background per WorksArchive
 * ════════════════════════════════════════════════════════════════════════
 * RUOLO
 *   Sfondo 3D vivente al centro della scena Z-Axis: una "cellula" che pulsa
 *   lentamente DIETRO i monoliti che volano. Non interattivo, non blocca lo
 *   scroll, fuso con il void OLED del sito.
 *
 * PERFORMANCE BLINDATA
 *   [1] KILL SWITCH (IntersectionObserver): quando il componente esce dal
 *       viewport → splineApp.stop() azzera il render-loop WebGL (0% GPU/CPU).
 *       Rientrando → splineApp.play(). In più mettiamo in pausa anche la CSS
 *       pulse (animationPlayState) via mutazione diretta del DOM → nessun
 *       re-render React.
 *   [2] MEMORY: allo smontaggio facciamo stop() + dispose() dell'Application
 *       Spline → libera contesto WebGL/VRAM. Observer disconnesso nel cleanup.
 *   [3] React.memo: il canvas non si ri-renderizza per i cambi del padre
 *       (WorksArchive). L'unica prop è `reduced` (booleano stabile).
 *
 * LAYERING (coerente con WorksArchive)
 *   z-index = Z_INDEX (1) → SOTTO .zg-viewport (z4) e .zg-monolith: i monoliti
 *   volano sempre davanti. La cellula sta sul fondo, come "infrastruttura viva".
 *
 * NIENTE CONFLITTI: nessun ScrollTrigger, nessun listener di scroll qui — solo
 * un IntersectionObserver. Lo scrub dei monoliti resta intoccato.
 *
 * SWAP REMOTO → LOCALE: l'URL della scena è isolato nella costante CELLULA_SCENE.
 * Per passare a un .splinecode locale basta sostituire quella stringa
 * (es. import scene from './cellula.splinecode?url').
 */

import React, { Suspense, lazy, memo, useRef, useEffect } from 'react';

// Stesso package del resto del sito (HeroSpline) → bundle Vite, non Next.
const Spline = lazy(() => import('@splinetool/react-spline'));

/* ── PUNTO UNICO DI CONFIGURAZIONE ──────────────────────────────────────── */
const CELLULA_SCENE = 'https://prod.spline.design/r-FlRUkpEdH5I7Ks/scene.splinecode';
const VOID = '#050505';

/* z-index della cellula. DEVE restare < z-index di .zg-viewport (4) così i
   monoliti volano davanti. Alza a 3 se preferisci la cellula DAVANTI al Void
   Core (Singularity) ma comunque sotto i monoliti. */
const Z_INDEX = 1;

function CellulaCore({ reduced }) {
  const wrapperRef = useRef(null);
  const splineApp = useRef(null);
  // Stato "desiderato" del loop finché l'Application non è pronta (onLoad).
  const shouldPlay = useRef(true);

  /* Applica play/stop in modo sicuro + mette in pausa la CSS pulse quando
     fuori vista. Solo refs + DOM diretto → ZERO re-render React. */
  const setActive = (active) => {
    shouldPlay.current = active;

    const app = splineApp.current;
    if (app) {
      try {
        if (active) app.play?.();
        else app.stop?.();
      } catch (_) {
        /* runtime non ancora pronto: lo stato verrà applicato in onLoad */
      }
    }

    const node = wrapperRef.current;
    if (node) node.style.animationPlayState = active ? 'running' : 'paused';
  };

  /* onLoad: salviamo l'Application e applichiamo lo stato corrente.
     reduced-motion → un frame e stop totale (nessun loop, nessuna GPU). */
  const handleLoad = (app) => {
    splineApp.current = app;
    if (reduced) {
      try { app.stop?.(); } catch (_) {}
      shouldPlay.current = false;
      return;
    }
    setActive(shouldPlay.current);
  };

  /* ── [1] KILL SWITCH — IntersectionObserver ───────────────────────────── */
  useEffect(() => {
    if (reduced) return; // nessun loop da governare in reduced-motion
    const node = wrapperRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0, rootMargin: '200px 0px' } // pre-accende poco prima dell'ingresso
    );
    io.observe(node);

    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  /* ── [2] MEMORY CLEANUP — dispose dell'Application allo smontaggio ─────── */
  useEffect(() => {
    return () => {
      const app = splineApp.current;
      try {
        app?.stop?.();
        app?.dispose?.(); // rilascia contesto WebGL / VRAM
      } catch (_) {}
      splineApp.current = null;
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className="cellula-core"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        // ALTEZZA/LARGHEZZA FISSE + absolute (fuori dal flow) → zero layout shift.
        width: 'min(92vw, 1100px)',
        height: 'min(92vh, 1100px)',
        transform: 'translate(-50%, -50%)',
        zIndex: Z_INDEX,
        pointerEvents: 'none', // non interferisce mai con scroll/click
        opacity: 0.9,
        // Fonde il glow con il void OLED: su sfondo near-black "screen" lascia
        // passare solo i pixel luminosi della cellula.
        mixBlendMode: 'screen',
        // Sfuma i bordi del canvas dentro il void (nessun bordo rettangolare).
        WebkitMaskImage:
          'radial-gradient(ellipse at 50% 50%, #000 52%, transparent 78%)',
        maskImage:
          'radial-gradient(ellipse at 50% 50%, #000 52%, transparent 78%)',
        // [3] Pulsazione lenta e organica (GPU-only: solo transform).
        animation: reduced
          ? 'none'
          : 'cellulaPulse 9s cubic-bezier(0.37, 0, 0.63, 1) infinite',
        willChange: 'transform',
        backgroundColor: 'transparent',
      }}
    >
      <Suspense fallback={null}>
        <Spline
          scene={CELLULA_SCENE}
          onLoad={handleLoad}
          style={{ width: '100%', height: '100%' }}
        />
      </Suspense>

      <style>{`
        @keyframes cellulaPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1);     }
          50%      { transform: translate(-50%, -50%) scale(1.035);  }
        }
        @media (prefers-reduced-motion: reduce) {
          .cellula-core { animation: none !important; }
        }
        /* Su mobile il 3D non deve mai catturare il touch (qui è già
           pointer-events:none, ma blindiamo come per .hero-spline-base). */
        @media (max-width: 768px) {
          .cellula-core { pointer-events: none !important; }
        }
      `}</style>
    </div>
  );
}

/* [3] React.memo — niente re-render del canvas WebGL dal padre WorksArchive. */
export default memo(CellulaCore);