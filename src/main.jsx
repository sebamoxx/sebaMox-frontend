import { useEffect } from 'react';
import './utils/consoleHijack'
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/700.css';
import '@fontsource/geist-sans/900.css';

// ─── Disable browser scroll restoration immediately, before any render. ───────
// Must happen at module-evaluation time so it fires before the first popstate
// event. If placed inside useEffect, the browser might already have restored
// scroll before React mounts.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

function Root() {
  useEffect(() => {
    let lenis      = null;
    let tickerFn   = null;
    let gsapModule = null;
    let resizeObs  = null;
    let onVisibility = null;
    let resizeDebounce = null;
    // ── FIX: guard flag prevents stale closure if the effect re-runs
    // (React 18 StrictMode double-invoke or Vite HMR) before the async
    // initLenis() promise resolves. Without this, lenis.destroy() is never
    // called on the first mount and window.__lenis holds a zombie instance.
    let mounted = true;

    // ── Robust touch detection: primary pointer is coarse (finger/stylus).
    // We intentionally do NOT add `navigator.maxTouchPoints > 0` here —
    // that would also disable Lenis on touch-capable laptops (Dell XPS 13,
    // Surface Pro with keyboard attached) where the primary pointer IS fine
    // (mouse/trackpad) and smooth scroll is desired.
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

    /* PERF FIX: rispetta prefers-reduced-motion. Chi ha attivato "Riduci
       movimento" a livello di sistema ottiene scroll NATIVO (niente virtual
       scroll JS): meno lavoro sul main thread → più FPS su macchine deboli, e
       accessibilità corretta. Tutto il resto dell'app fa già fallback a
       window.scrollTo quando window.__lenis è assente, quindi zero regressioni. */
    const prefersReducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const initLenis = async () => {
      // ── ARCHITECTURAL DECISION: never run Lenis on touch-primary devices.
      // Mobile browsers manage momentum scroll through the hardware compositor.
      // When JS intercepts touchmove (which Lenis does in syncTouch mode),
      // the compositor thread is blocked → the notorious freeze / bounce /
      // jank on iOS Safari and Chrome Android.
      //
      // NOTE on `syncTouch`: deliberately NOT used. syncTouch re-implements
      // touch inertia in JS and is the single most common cause of mobile
      // scroll-lock in Lenis-powered sites. Native compositor scroll on
      // mobile + virtual scroll on desktop is the architecture used by the
      // overwhelming majority of Awwwards SOTD sites. The mobile freeze bug
      // did NOT come from here — it came from a non-passive touch trap in
      // App.jsx (ScrollProgress hitbox), fixed there.
      //
      /* PERF FIX: la guard ora copre anche prefers-reduced-motion → un solo
         early-return per entrambi i casi in cui NON vogliamo Lenis. */
      if (isTouchDevice || prefersReducedMotion) {
        console.info('[Root] Touch device o reduced-motion — Lenis disabilitato, scroll nativo attivo.');
        return;
      }

      try {
        /* PERF FIX: import dinamici IN PARALLELO (Promise.all) invece di tre
           `await import()` in fila. Prima: lenis → gsap → ScrollTrigger erano
           tre round-trip sequenziali (waterfall di rete/parse). Ora partono
           insieme e si attende il più lento → Lenis è pronto prima, lo scroll
           virtuale si attiva con meno ritardo dopo il mount. */
        const [lenisMod, gsapMod, stMod] = await Promise.all([
          import('lenis'),
          import('gsap'),
          import('gsap/ScrollTrigger'),
        ]);

        // ── FIX: bail out if the effect was cleaned up while we were
        // awaiting the dynamic imports (StrictMode, HMR, fast navigation).
        if (!mounted) return;

        const Lenis             = lenisMod.default;
        gsapModule              = gsapMod;          // serve al cleanup per rimuovere il ticker
        const gsap              = gsapMod.default;
        const { ScrollTrigger } = stMod;

        gsap.registerPlugin(ScrollTrigger);

        lenis = new Lenis({
          duration: 1.2,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),

          // ── FIX PHANTOM SCROLL #1 — DOUBLE-RAF KILL ──────────────────────
          // Recent versions of the `lenis` package self-start their own
          // requestAnimationFrame loop (autoRaf defaults to true). Combined
          // with the GSAP ticker below, Lenis was being stepped TWICE per
          // frame with two different time bases → the lerp advanced with
          // inconsistent deltas → periodic micro-stutter even at idle.
          // ONE driver only: the GSAP ticker. Explicitly off.
          autoRaf: false,

          // ── FIX JITTER MOBILE — DISATTIVAZIONE TOUCH CORRETTA ────────────
          // RIMOSSO: touchMultiplier: 0 (Causava la lotta contro lo scroll nativo!)
          // AGGIUNTO: Questi due parametri spengono ufficialmente e in modo sicuro
          // qualsiasi interferenza di Lenis con gli schermi touch.
          smoothTouch: false,
          syncTouch: false,
        });

        lenis.on('scroll', ScrollTrigger.update);

        // ── SINGLE CLOCK: Lenis is driven exclusively by the GSAP ticker.
        tickerFn = (time) => lenis.raf(time * 1000);
        gsap.ticker.add(tickerFn);

        // ── FIX PHANTOM SCROLL #2 — TIME-WARP KILL ─────────────────────────
        // GSAP's default lagSmoothing (500ms cap, 33ms adjustment) REWRITES
        // the ticker time after every long task. Garbage collection fires
        // every few seconds even on an idle page → the `time` handed to
        // lenis.raf() warps → Lenis computes a wrong delta → the visible
        // "phantom" micro-jump every few seconds. lagSmoothing(0) hands
        // Lenis honest wall-clock time. This is the official Lenis + GSAP
        // integration recipe.
        gsap.ticker.lagSmoothing(0);

        // ── FIX TAB-SWITCH BOUNCE (the reason lagSmoothing(0) was once
        // removed from this file) ──────────────────────────────────────────
        // With lagSmoothing(0), returning from a background tab delivers one
        // giant time delta → any in-flight scroll animation completes
        // instantly (teleport). Instead of re-capping the clock (which
        // re-introduces the phantom jitter), we surgically freeze Lenis
        // while the tab is hidden and re-sync it on return:
        //   hidden  → lenis.stop()  (no animation can be in flight)
        //   visible → hard re-sync to the real scroll position, then start.
        // Both bugs fixed, zero trade-off.
        onVisibility = () => {
          if (!lenis) return;
          if (document.hidden) {
            lenis.stop();
          } else {
            lenis.scrollTo(window.scrollY, { immediate: true, force: true });
            lenis.start();
          }
        };
        document.addEventListener('visibilitychange', onVisibility);

        // ── FIX PHANTOM SCROLL #3 — STALE BOUNDS KILL ──────────────────────
        // React Router + Suspense mount lazy sections whose final height
        // differs from the 100dvh fallback. Images and webfonts shift layout
        // again later. Lenis caches the scroll limit; ScrollTrigger caches
        // every trigger position. Stale caches → clamp corrections and
        // mis-firing pins → visible jumps.
        // A single ResizeObserver on <body> is the source of truth: any
        // height change → debounced lenis.resize() + ScrollTrigger.refresh().
        // Debounced at 200ms so a burst of mounts (route change) costs ONE
        // refresh, and guarded by a height delta check so sub-pixel noise
        // never triggers the (expensive) refresh.
        //
        // EDGE CASE (barra indirizzi mobile / orientation): qui Lenis è già
        // disabilitato su touch, ma il delta-guard sotto è comunque la difesa
        // corretta: la barra Safari che appare/scompare cambia la VIEWPORT, non
        // lo scrollHeight del CONTENUTO → l'osservatore NON spara un refresh
        // distruttivo. Solo un cambio reale di altezza del documento lo fa.
        let lastHeight = document.body.scrollHeight;
        resizeObs = new ResizeObserver(() => {
          const h = document.body.scrollHeight;
          if (Math.abs(h - lastHeight) < 1) return;
          lastHeight = h;
          clearTimeout(resizeDebounce);
          resizeDebounce = setTimeout(() => {
            if (!mounted || !lenis) return;
            lenis.resize();
            ScrollTrigger.refresh();
          }, 200);
        });
        resizeObs.observe(document.body);

        // Expose globally so ScrollToTop and page components can use
        // lenis.scrollTo() without prop-drilling or a context provider.
        window.__lenis       = lenis;
        window.__lenisTicker = tickerFn;
        // Also expose gsap so external cleanup (e.g. page unmount) can
        // call gsap.ticker.remove() if needed without a redundant import.
        window.__gsap        = gsap;

      } catch (err) {
        console.info('[Root] Lenis not available, falling back to native scroll.', err);
      }
    };

    initLenis();

    return () => {
      // Signal the async function not to write globals after this point.
      mounted = false;

      clearTimeout(resizeDebounce);
      if (resizeObs) {
        resizeObs.disconnect();
        resizeObs = null;
      }
      if (onVisibility) {
        document.removeEventListener('visibilitychange', onVisibility);
        onVisibility = null;
      }
      /* PERF FIX / NO-LEAK: rimuovo il ticker usando il riferimento LOCALE
         `tickerFn`, non il global window.__lenisTicker. Se un re-run dell'effect
         (HMR/StrictMode) avesse sovrascritto il global, il vecchio ticker
         resterebbe agganciato al clock GSAP = leak che chiama lenis.raf() su
         un'istanza distrutta. Il local è sempre quello di QUESTA istanza. */
      if (tickerFn && gsapModule) {
        gsapModule.default.ticker.remove(tickerFn);
      }
      if (lenis) {
        lenis.destroy();
        lenis = null;
      }
      window.__lenis       = null;
      window.__lenisTicker = null;
      window.__gsap        = null;
    };
  }, []);

  return <App />;
}

createRoot(document.getElementById('root')).render(<Root />);