/**
 * HeroSpline.jsx — Wrapper 3D di sfondo (Spline) + Anti-Jump (v3.0 — Hardened)
 * ──────────────────────────────────────────────────────────────────────────
 * COSA FA
 *   Monta la scena Spline come fondale a tutto schermo dell'hero, congelando
 *   l'altezza del canvas per non subire il collasso della barra indirizzi su
 *   mobile, e spegnendo il render loop quando la scena esce dal viewport.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * CORREZIONI RISPETTO ALLA v2.1 (tutte verificate sul codice del progetto)
 * ──────────────────────────────────────────────────────────────────────────
 * [FIX 1] PERCORSO SCENA ASSOLUTO.
 *   Era 'elementi3D/robotoHero.splinecode' — relativo. Risolve correttamente
 *   solo se l'URL corrente è la radice: da un qualsiasi path con segmenti
 *   (o con slash finale) il browser cerca /qualcosa/elementi3D/... → 404 e
 *   canvas nero. Con lo slash iniziale il percorso è sempre lo stesso.
 *
 * [FIX 2] DISPOSE DEL CONTESTO WEBGL ALL'UNMOUNT.
 *   In App.jsx la HomePage è montata con key={location.pathname}: torni sulla
 *   home ⇒ l'intero albero si rimonta ⇒ nasce una nuova istanza Spline. Senza
 *   dispose esplicito i contesti WebGL si accumulano; i browser ne tengono in
 *   vita una quindicina, poi iniziano a revocare i più vecchi ("context lost")
 *   e il robot diventa nero. Ora l'app Spline viene fermata e distrutta.
 *
 * [FIX 3] RI-MISURA DELL'ALTEZZA SOLO ALLA ROTAZIONE VERA.
 *   L'handler di 'orientationchange' leggeva window.innerHeight NELL'ISTANTE
 *   dell'evento, quando il browser riporta ancora le dimensioni vecchie →
 *   congelava il valore sbagliato. Ora si rimisura dopo che il layout si è
 *   assestato, e SOLO se è cambiata la larghezza: così il collasso della
 *   barra indirizzi (che cambia solo l'altezza) non annulla l'anti-jump.
 *
 * [FIX 4] API SPLINE DIFESE.
 *   play() / stop() / dispose() esistono nelle versioni recenti del runtime ma
 *   non in tutte: ogni chiamata è opzionale e protetta. Un cambio di versione
 *   della libreria non può più far crashare la home.
 *
 * [FIX 5] reduced-motion REATTIVO.
 *   Era letto una volta sola durante il render. Ora un listener aggiorna lo
 *   stato se l'utente cambia la preferenza a sessione aperta.
 *
 * OTTIMIZZAZIONI MANTENUTE DALLA v2.1
 *   · React.memo (nessuna prop → bail-out su ogni render del genitore)
 *   · rimozione di will-change/transition a transizione conclusa (libera VRAM)
 *   · IntersectionObserver singolo, deps [] → mai ricreato
 *   · onLoad stabile con useCallback
 *   · ref di visibilità letta dentro onLoad: se hai già scrollato via prima che
 *     la scena finisca di caricare, non parte nemmeno un frame di autoplay
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

/* [FIX 1] percorso assoluto: indipendente dall'URL corrente */
const SCENE_URL = '/elementi3D/robotoHero.splinecode';
const VOID = '#050505';

function HeroSpline() {
  const wrapperRef = useRef(null);
  const innerRef = useRef(null);

  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [frozenH, setFrozenH] = useState(null);
  const [settled, setSettled] = useState(false);

  const splineApp = useRef(null);

  /* Ref di visibilità: vive fuori dal ciclo di render, quindi è già
     aggiornata quando onLoad viene invocato (lo stato React no). */
  const isVisibleRef = useRef(true);

  /* [FIX 5] reduced-motion come stato reattivo */
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return undefined;
    }
    const onChange = (e) => setReduced(e.matches);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    if (typeof mq.addListener === 'function') {
      mq.addListener(onChange); // Safari datato
      return () => mq.removeListener(onChange);
    }
    return undefined;
  }, []);

  /* ── [FIX 3] Anti-jump: congela l'altezza, rimisura solo alla rotazione ── */
  useEffect(() => {
    let timer = 0;
    let lastWidth = window.innerWidth;

    const measure = () => {
      lastWidth = window.innerWidth;
      setFrozenH(window.innerHeight);
    };
    measure();

    const onViewportChange = () => {
      /* Se cambia SOLO l'altezza è la barra indirizzi che collassa: ignoriamo,
         è esattamente ciò da cui l'anti-jump ci protegge. Rimisuriamo quando
         cambia la larghezza (rotazione o resize vero), e lo facciamo in
         differita perché al momento dell'evento il browser riporta ancora le
         dimensioni precedenti. */
      if (window.innerWidth === lastWidth) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 300);
    };

    window.addEventListener('orientationchange', onViewportChange);
    window.addEventListener('resize', onViewportChange, { passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('orientationchange', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
    };
  }, []);

  /* ── IntersectionObserver: unico, mai ricreato ── */
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        isVisibleRef.current = entry.isIntersecting;
        setVisible(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ── Cleanup del layer GPU a transizione conclusa ── */
  useEffect(() => {
    if (!loaded || settled) return undefined;
    const node = innerRef.current;
    if (!node) return undefined;

    if (reduced) {
      const t = window.setTimeout(() => setSettled(true), 550);
      return () => window.clearTimeout(t);
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
    const fallback = window.setTimeout(finish, 2200);

    return () => {
      node.removeEventListener('transitionend', onEnd);
      window.clearTimeout(fallback);
    };
  }, [loaded, settled, reduced]);

  /* ── onLoad stabile + kill immediato se sei già scrollato via ── */
  const handleLoad = useCallback((spline) => {
    splineApp.current = spline;
    setLoaded(true);

    if (!isVisibleRef.current) {
      try { spline.stop?.(); } catch { /* API assente in questa versione */ }
    }
  }, []);

  /* ── Kill switch legato alla visibilità ── */
  useEffect(() => {
    const app = splineApp.current;
    if (!app) return;
    try {
      if (visible) app.play?.();
      else app.stop?.();
    } catch { /* API assente: la scena resta com'è, nessun crash */ }
  }, [visible]);

  /* ── [FIX 2] DISPOSE: libera il contesto WebGL all'unmount ──
     Effetto separato con deps [] così gira UNA volta sola, allo smontaggio
     reale del componente, e non a ogni cambio di `visible`. */
  useEffect(() => {
    return () => {
      const app = splineApp.current;
      if (!app) return;
      try { app.stop?.(); } catch { /* ignora */ }
      try { app.dispose?.(); } catch { /* ignora */ }
      splineApp.current = null;
    };
  }, []);

  const canvasHeight = frozenH ? `${frozenH}px` : '100svh';
  const shown = loaded && visible;

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .hero-spline-base, .hero-spline-inner { pointer-events: none !important; }
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