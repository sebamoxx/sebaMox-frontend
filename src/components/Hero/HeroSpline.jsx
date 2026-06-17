/**
 * HeroSpline.jsx — Wrapper 3D di sfondo (Spline) + Anti-Jump (v2.1 — Perf Hardened)
 * ──────────────────────────────────────────────────────────────────────────
 * FIX JUMP: Altezza congelata per ignorare il collasso della address bar.
 * FIX TOUCH: CSS Injection per disabilitare pointer-events su mobile.
 *
 * OTTIMIZZAZIONI PERFORMANCE (v2.1) — applicate SENZA toccare design/comportamento:
 * [1] React.memo: il wrapper del canvas WebGL NON si ri-renderizza mai per un
 * cambio di stato del padre (Hero.jsx). Non riceve props → memo fa sempre
 * bail-out sui render del genitore.
 * [2] VRAM LEAK FIX: `will-change` e `transition` vengono RIMOSSI dinamicamente
 * dal div d'ingresso una volta completata l'animazione `scale(1)`, tramite
 * evento `transitionend` (con timeout di sicurezza). Così il browser libera
 * il layer GPU dedicato invece di tenerlo allocato per sempre.
 * [3] IntersectionObserver: istanza UNICA, deps `[]` corrette → mai ricreato.
 * [4] onLoad stabilizzato con useCallback → nessun churn di prop sul <Spline>.
 */

import React, {
  Suspense,
  lazy,
  memo,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

const SCENE_URL = 'elementi3D/robotoHero.splinecode';
const VOID = '#050505';

function HeroSpline() {
  const wrapperRef = useRef(null);
  const innerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [frozenH, setFrozenH] = useState(null);
  const [settled, setSettled] = useState(false);

  const splineApp = useRef(null);
  
  // 1. LA MAGIA: Una ref che vive fuori dal ciclo di render di React per non avere mai ritardi
  const isVisibleRef = useRef(true); 

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Anti-jump: congela l'altezza; ri-misura SOLO al cambio orientamento. ── */
  useEffect(() => {
    const freeze = () => setFrozenH(window.innerHeight);
    freeze();
    window.addEventListener('orientationchange', freeze);
    return () => window.removeEventListener('orientationchange', freeze);
  }, []);

  /* ── [3] IntersectionObserver ── */
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // 2. AGGIORNAMENTO INCROCIATO: Salviamo lo stato sia per React che per Spline
        isVisibleRef.current = entry.isIntersecting;
        setVisible(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ── [2] VRAM CLEANUP ── */
  useEffect(() => {
    if (!loaded || settled) return;
    const node = innerRef.current;
    if (!node) return;

    if (reduced) {
      const t = setTimeout(() => setSettled(true), 550);
      return () => clearTimeout(t);
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setSettled(true);
    };

    const onEnd = (e) => {
      if (e.target === node && e.propertyName === 'transform') finish();
    };
    node.addEventListener('transitionend', onEnd);

    const fallback = setTimeout(finish, 2200);

    return () => {
      node.removeEventListener('transitionend', onEnd);
      clearTimeout(fallback);
    };
  }, [loaded, settled, reduced]);

  /* ── [4] onLoad stabile ── */
  const handleLoad = useCallback((spline) => {
    splineApp.current = spline; 
    setLoaded(true);

    // 3. IL CONTROLLO ANTI-LAG ASSOLUTO:
    // Spline ha appena finito di caricare. Ma noi scrolliamo prima?
    // Controlliamo isVisibleRef: se è false, lo "strangoliamo" immediatamente prima che avvii l'autoplay.
    if (!isVisibleRef.current) {
      spline.stop();
    }
  }, []);

  const canvasHeight = frozenH ? `${frozenH}px` : '100svh';
  const shown = loaded && visible;

  /* ── IL KILL SWITCH NORMALE ── */
  useEffect(() => {
    if (!splineApp.current) return;
    
    if (visible) {
      splineApp.current.play(); 
    } else {
      splineApp.current.stop(); 
    }
  }, [visible]);

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .hero-spline-base, .hero-spline-inner {
            pointer-events: none !important;
          }
        }
      `}</style>

      <div
        ref={wrapperRef}
        aria-hidden="true"
        className="hero-spline-base"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          backgroundColor: VOID,
          pointerEvents: visible ? 'auto' : 'none',
          zIndex: 0,
          overflow: 'hidden',
        }}
      >
        <Suspense fallback={null}>
          <div
            ref={innerRef}
            className="hero-spline-inner"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: canvasHeight,
              visibility: visible ? 'visible' : 'hidden',
              opacity: shown ? 1 : 0,
              transform: loaded ? 'scale(1)' : 'scale(1.04)',
              transition: settled
                ? 'none'
                : reduced
                ? 'opacity 0.5s linear'
                : 'opacity 1.4s cubic-bezier(0.32,0.72,0,1), transform 1.8s cubic-bezier(0.32,0.72,0,1)',
              pointerEvents: visible ? 'auto' : 'none',
              willChange: settled ? 'auto' : 'opacity, transform',
            }}
          >
            <Spline
              scene={SCENE_URL}
              onLoad={handleLoad}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </Suspense>
      </div>
    </>
  );
}

export default memo(HeroSpline);