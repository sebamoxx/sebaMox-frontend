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

// 🔴 MODIFICA: Ora punta al file locale nella cartella public, zero chiamate esterne!
const SCENE_URL = 'elementi3D/robotoHero.splinecode';
const VOID = '#050505';

function HeroSpline() {
  const wrapperRef = useRef(null);
  const innerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [frozenH, setFrozenH] = useState(null);
  // true → animazione d'ingresso conclusa: will-change/transition rimossi (VRAM)
  const [settled, setSettled] = useState(false);

  const splineApp = useRef(null);

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

  /* ── [3] IntersectionObserver: istanza UNICA.
        `wrapperRef` (ref stabile) e `setVisible` (setter stabile) NON cambiano
        mai identità → l'array di dipendenze `[]` è corretto e completo, e
        l'observer non viene MAI ricreato/riassegnato durante la vita del
        componente. `setVisible` fa bail-out automatico se il valore non cambia,
        quindi niente render extra a parità di stato di visibilità. ── */
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0, rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ── [2] VRAM CLEANUP: appena l'animazione d'ingresso (transform → scale(1))
        è completa, togliamo `will-change` e `transition`. Il browser de-alloca
        il layer GPU permanente, cruciale sulle macchine più vecchie. ── */
  useEffect(() => {
    if (!loaded || settled) return;
    const node = innerRef.current;
    if (!node) return;

    // reduced-motion: il transform non ha transizione → settla a breve.
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

    // Aspettiamo la proprietà più lunga (transform 1.8s); ignoriamo i bubbling
    // di eventuali figli (es. canvas) col check su e.target.
    const onEnd = (e) => {
      if (e.target === node && e.propertyName === 'transform') finish();
    };
    node.addEventListener('transitionend', onEnd);

    // Safety net: se transitionend non scatta (tab in background, GPU sotto
    // carico, ecc.) liberiamo comunque la VRAM poco dopo la durata nominale.
    const fallback = setTimeout(finish, 2200);

    return () => {
      node.removeEventListener('transitionend', onEnd);
      clearTimeout(fallback);
    };
  }, [loaded, settled, reduced]);

  /* ── [4] onLoad stabile → il <Spline> non riceve una nuova funzione ad ogni
        render, evitando lavoro inutile sul wrapper del canvas. ── */
  const handleLoad = useCallback((spline) => {
    splineApp.current = spline; // Salviamo il motore in memoria
    setLoaded(true);
  }, []);

  const canvasHeight = frozenH ? `${frozenH}px` : '100svh';
  const shown = loaded && visible;

  /* ── IL KILL SWITCH: Spegne il loop matematico di Spline se non lo guardi ── */
  useEffect(() => {
    if (!splineApp.current) return;
    
    if (visible) {
      splineApp.current.play(); // Riaccende il motore quando torni nella Hero
    } else {
      splineApp.current.stop(); // Uccide i calcoli (Zero CPU/GPU) appena scorri giù!
    }
  }, [visible]);

  return (
    <>
      {/* LA MAGIA È QUI: Questa riga forza lo spegnimento del touch sul 3D
          solo ed esclusivamente sugli smartphone, permettendo lo scroll nativo. */}
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
              // [2] transition rimossa dopo l'ingresso → nessun lavoro GPU residuo
              transition: settled
                ? 'none'
                : reduced
                ? 'opacity 0.5s linear'
                : 'opacity 1.4s cubic-bezier(0.32,0.72,0,1), transform 1.8s cubic-bezier(0.32,0.72,0,1)',
              pointerEvents: visible ? 'auto' : 'none',
              // [2] will-change attivo SOLO durante l'ingresso → poi VRAM liberata
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

/* [1] React.memo: nessun re-render del wrapper WebGL innescato dal padre
   (Hero.jsx). Il componente non riceve props → memo fa sempre bail-out. */
export default memo(HeroSpline);