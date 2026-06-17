import React, {
  Suspense,
  lazy,
  memo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

// 🔴 Secondo robot, file locale in /public
const ROBOT_SCENE_URL = 'elementi3D/robotCTA.splinecode';

function RobotSplineBase({
  scene = ROBOT_SCENE_URL,
  sectionRef = null,
  deferMount = true,
  enableDesktopHover = false,
  // ── PRELOAD: margine ampio → monta/scarica la scena PRIMA che entri,
  //    così non c'è il "pop-in" quando arrivi alla sezione.
  preloadMargin = '1000px 0px 1000px 0px',
  // ── KILL-SWITCH: margine STRETTO → play()/stop() seguono la visibilità
  //    REALE. È questo il valore che congela il motore WebGL fuori schermo.
  playMargin = '0px 0px 0px 0px',
  isHovered = false, // hover del bottone CTA
}) {
  const wrapperRef = useRef(null);
  const splineAppRef = useRef(null);

  // Stato del motore, tenuto in ref per non innescare re-render.
  const isPlayingRef = useRef(false);   // riflette se app.play() è attivo
  const isVisibleRef = useRef(false);   // sezione realmente nel viewport
  const isTabActiveRef = useRef(
    typeof document === 'undefined' ? true : !document.hidden
  );

  const [mounted, setMounted] = useState(!deferMount);
  const [ready, setReady] = useState(false);

  const reducedRef = useRef(
    typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  /* ── CUORE DEL KILL-SWITCH ──────────────────────────────────────
     Unica fonte di verità: decide se il motore DEVE girare e applica
     play()/stop() solo se lo stato reale diverge. Idempotente, quindi
     può essere chiamata da observer, tab-switch o reduced-motion senza
     accendere/spegnere a vuoto.                                        */
  const reconcile = useCallback(() => {
    const app = splineAppRef.current;
    if (!app) return;

    const shouldPlay =
      isVisibleRef.current && isTabActiveRef.current && !reducedRef.current;

    if (shouldPlay && !isPlayingRef.current) {
      isPlayingRef.current = true;
      try { app.play(); } catch (_) {}
    } else if (!shouldPlay && isPlayingRef.current) {
      isPlayingRef.current = false;
      try { app.stop(); } catch (_) {} // ferma render loop, controlli ed eventi
    }
  }, []);

  /* ── onLoad: salviamo l'istanza e congeliamo SUBITO ──────────────
     Spline parte in autoplay appena caricato: lo blocchiamo all'istante
     e lasciamo che reconcile() decida in base alla visibilità corrente. */
  const handleLoad = useCallback(
    (app) => {
      splineAppRef.current = app;
      isPlayingRef.current = true; // dopo onLoad il runtime sta già renderizzando
      try { app.stop(); } catch (_) {}
      isPlayingRef.current = false;
      setReady(true);
      reconcile();
    },
    [reconcile]
  );

  /* ── OBSERVER: due osservatori, due compiti distinti ─────────────
     • mountObserver (margine ampio)  → monta la scena in anticipo, poi
       si disconnette: serve una sola volta.
     • playObserver  (margine stretto) → governa play/stop sulla
       visibilità reale per tutta la vita del componente.               */
  useEffect(() => {
    const target = (sectionRef && sectionRef.current) || wrapperRef.current;
    if (!target) return undefined;

    // Fallback SSR / browser senza IntersectionObserver: monta e gioca.
    if (typeof IntersectionObserver === 'undefined') {
      isVisibleRef.current = true;
      setMounted(true);
      reconcile();
      return undefined;
    }

    const mountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          mountObserver.disconnect(); // preload una tantum
        }
      },
      { threshold: 0, rootMargin: preloadMargin }
    );
    mountObserver.observe(target);

    const playObserver = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        reconcile(); // accende/spegne il motore 3D in base alla visibilità reale
      },
      { threshold: 0, rootMargin: playMargin }
    );
    playObserver.observe(target);

    return () => {
      mountObserver.disconnect();
      playObserver.disconnect();
    };
  }, [sectionRef, preloadMargin, playMargin, reconcile]);

  /* ── TAB SWITCH: freeze quando la pagina è in background ─────────
     Senza questo, cambiare tab lascia il loop WebGL acceso a sprecare
     GPU/CPU anche se la sezione è "visibile" nel DOM.                  */
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibility = () => {
      isTabActiveRef.current = !document.hidden;
      reconcile();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [reconcile]);

  /* ── CLEANUP UNMOUNT: dispose una sola volta, alla distruzione ────
     Separato dagli observer così non distruggiamo mai l'app mentre il
     componente è ancora montato (es. se cambiano le prop dell'observer). */
  useEffect(() => {
    return () => {
      const app = splineAppRef.current;
      if (app) {
        try { app.stop(); } catch (_) {}
        try { app.dispose && app.dispose(); } catch (_) {}
      }
      splineAppRef.current = null;
      isPlayingRef.current = false;
    };
  }, []);

  /* ── HOVER del bottone CTA (solo se visibile) ────────────────────── */
  useEffect(() => {
    const app = splineAppRef.current;
    if (!app || !isVisibleRef.current) return;
    try {
      app.emitEvent(isHovered ? 'mouseDown' : 'mouseUp', 'RobotContainer');
    } catch (_) {}
  }, [isHovered]);

  /* ── AUTOPLAY MOBILE (il "battito" del cuore) ────────────────────── */
  useEffect(() => {
    if (!ready) return undefined;

    let timeoutId;

    const triggerMobileHeartbeat = () => {
      const app = splineAppRef.current;
      const isMobile = window.innerWidth < 1024;
      // Niente battito se off-screen / tab nascosta: rispetta il kill-switch.
      if (!app || !isVisibleRef.current || !isTabActiveRef.current || !isMobile) return;

      try { app.emitEvent('mouseDown', 'RobotContainer'); } catch (_) {}
      timeoutId = setTimeout(() => {
        try { app.emitEvent('mouseUp', 'RobotContainer'); } catch (_) {}
      }, 2000);
    };

    const intervalId = setInterval(triggerMobileHeartbeat, 4500);

    return () => {
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [ready]);

  return (
    <>
      <style>{`
        .robot-spline-stage{
          position:absolute;
          z-index:2;
          top:50%;
          right:0;
          width:48%;
          height:clamp(420px, 66%, 760px);
          transform:translateY(-50%) translateZ(0);
          pointer-events:none;
          opacity:${ready ? 1 : 0};
          transition:opacity 1s cubic-bezier(0.32,0.72,0,1);
        }
        .robot-spline-canvas{
          width:100%;
          height:100%;
          pointer-events:none;
        }
        ${enableDesktopHover ? `
        @media (min-width:1024px){
          .robot-spline-canvas{ pointer-events:auto; }
        }` : ``}
        @media (max-width:1023px){
          .robot-spline-stage{
            top:clamp(1.5rem, 9vw, 5rem);
            right:auto;
            left:50%;
            width:min(90vw, 440px);
            height:min(64vw, 360px);
            transform:translateX(-50%) translateZ(0);
            opacity:${ready ? 0.22 : 0};
          }
        }
        @media (prefers-reduced-motion: reduce){
          .robot-spline-stage{ transition:none; }
        }
      `}</style>

      <div ref={wrapperRef} className="robot-spline-stage" aria-hidden="true">
        {mounted && (
          <Suspense fallback={null}>
            <Spline
              scene={scene}
              onLoad={handleLoad}
              className="robot-spline-canvas"
              style={{ width: '100%', height: '100%' }}
            />
          </Suspense>
        )}
      </div>
    </>
  );
}

const RobotSpline = memo(RobotSplineBase);

export default RobotSpline;
