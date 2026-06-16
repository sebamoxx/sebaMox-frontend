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

// 🔴 MODIFICA: Ora punta al file locale del secondo robot nella cartella public
const ROBOT_SCENE_URL = 'elementi3D/robotCTA.splinecode';

function RobotSplineBase({
  scene = ROBOT_SCENE_URL,
  sectionRef = null,
  deferMount = true,
  enableDesktopHover = false,
  rootMargin = '1000px 0px 1000px 0px',
  isHovered = false, // <--- PROP PER HOVER DEL BOTTONE
}) {
  const wrapperRef = useRef(null);
  const splineApp = useRef(null);
  const playing = useRef(false);
  const visible = useRef(false);

  const [mounted, setMounted] = useState(!deferMount);
  const [ready, setReady] = useState(false);

  const reduced = useRef(
    typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // LA LOGICA DEL KILL SWITCH: Spegne il motore se non è visibile
  const reconcile = useCallback(() => {
    const app = splineApp.current;
    if (!app) return;
    const shouldPlay = visible.current && !reduced.current;

    if (shouldPlay && !playing.current) {
      playing.current = true;
      try { app.play(); } catch (_) {}
    } else if (!shouldPlay && playing.current) {
      playing.current = false;
      try { app.stop(); } catch (_) {}
    }
  }, []);

  const handleLoad = useCallback(
    (app) => {
      splineApp.current = app;
      playing.current = false;
      try { app.stop(); } catch (_) {}
      setReady(true);
      reconcile();
    },
    [reconcile]
  );

  /* ── L'EFFETTO PER L'HOVER DEL BOTTONE (DOPPIO EVENTO ESPLICITO) ── */
  useEffect(() => {
    const app = splineApp.current;
    if (!app || !visible.current) return;

    if (isHovered) {
      // Andata: Il cursore entra nel bottone -> scateniamo l'animazione
      try { app.emitEvent('mouseDown', 'RobotContainer'); } catch(e) {}
    } else {
      // Ritorno: Il cursore esce dal bottone -> forziamo il ritorno alla base
      try { app.emitEvent('mouseUp', 'RobotContainer'); } catch(e) {}
    }
  }, [isHovered]);


  /* ── 2. IL KILL-SWITCH (INTERSECTION OBSERVER) ── */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      visible.current = true;
      setMounted(true);
      reconcile();
      return undefined;
    }

    const target = (sectionRef && sectionRef.current) || wrapperRef.current;
    if (!target) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
        if (entry.isIntersecting) setMounted(true);
        reconcile(); // Attiva o disattiva il motore 3D in base alla visibilità
      },
      { threshold: 0, rootMargin }
    );
    observer.observe(target);

    return () => {
      observer.disconnect();
      const app = splineApp.current;
      if (app) {
        try { app.stop(); } catch (_) {}
        try { app.dispose && app.dispose(); } catch (_) {}
      }
      splineApp.current = null;
      playing.current = false;
    };
  }, [sectionRef, rootMargin, reconcile]);

  /* ── 3. AUTOPLAY MOBILE (Il "Battito" del Cuore) ── */
  useEffect(() => {
    if (!ready) return;

    let timeoutId;

    const triggerMobileHeartbeat = () => {
      const app = splineApp.current;
      
      const isMobile = window.innerWidth < 1024;
      if (!app || !visible.current || !isMobile) return;

      // 1. ANDATA: Accendiamo il cuore
      try { app.emitEvent('mouseDown', 'RobotContainer'); } catch(e) {}

      // 2. RITORNO: Lo spegniamo dopo 2 secondi
      timeoutId = setTimeout(() => {
        try { app.emitEvent('mouseUp', 'RobotContainer'); } catch(e) {}
      }, 2000); 
    };

    const intervalId = setInterval(triggerMobileHeartbeat, 6000);

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