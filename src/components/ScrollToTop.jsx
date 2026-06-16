import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────────────────────────────────────
// ScrollToTop — reset dello scroll ad ogni cambio rotta
// ─────────────────────────────────────────────────────────────────────────────
//
// FIX "PAGINE NON COLLEGATE" (scroller interno mobile):
//   Da quando, su touch, la barra del browser è bloccata facendo scrollare #root
//   invece del documento (vedi index.css @media pointer:coarse + App.jsx), lo
//   scroll NON vive più sul window. Il vecchio reset (window.scrollTo(0,0) +
//   document.body.scrollTop = 0) azzerava l'elemento SBAGLIATO → cambiando rotta
//   (es. → /works, → /contact) #root restava scrollato a metà e la nuova pagina
//   si apriva "in mezzo", sembrando scollegata.
//   FIX: su touch azzeriamo #root.scrollTop; su desktop restiamo su Lenis/window.
//
// I due guard (state.scrollTo e window.__scrollIntent) restano invariati: quando
// è in corso un ritorno "intent-aware" alla home con scroll verso una sezione,
// è la pipeline di App.jsx (scrollToElementWhenReady) a gestire la posizione.
// ─────────────────────────────────────────────────────────────────────────────

// Azzera lo scroller corretto in base al device.
const resetScrollTop = () => {
  // Su touch lo scroll è dentro #root (barra del browser fissa).
  const coarse = typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const root = document.getElementById('root');

  if (coarse && root) {
    root.scrollTop = 0;
    return;
  }
  if (window.__lenis) {
    window.__lenis.scrollTo(0, { immediate: true });
    return;
  }
  // Desktop senza Lenis / fallback: azzera ogni possibile scroller del documento.
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

export default function ScrollToTop() {
  const { pathname, state } = useLocation();
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    // ── GUARD 1: target esplicito → ci pensa App.jsx (scrollToElementWhenReady) ──
    if (state?.scrollTo || state?.scrollToWorks || state?.noScrollReset) {
      prevPathRef.current = pathname;
      return;
    }

    // ── GUARD 2: transizione "intent" in corso → non interferire ──────────────
    if (window.__scrollIntent?.active) {
      prevPathRef.current = pathname;
      return;
    }

    // ── RESET STANDARD (cambio rotta senza target specifico) ──────────────────
    if (pathname !== prevPathRef.current) {
      // Uccidiamo i trigger PRIMA di scrollare per evitare che i pin-spacer in
      // dismissione interferiscano con il reset.
      ScrollTrigger.getAll().forEach((st) => st.kill());

      // FIX: azzera lo scroller GIUSTO (#root su touch, window/Lenis su desktop).
      resetScrollTop();

      prevPathRef.current = pathname;

      // Cascade refresh progressivo — i Suspense lazy si idratano in ritardo.
      const ids = [
        setTimeout(() => ScrollTrigger.refresh(true),  50),
        setTimeout(() => ScrollTrigger.refresh(true), 500),
        setTimeout(() => ScrollTrigger.refresh(true), 1200),
      ];

      return () => ids.forEach(clearTimeout);
    }
  }, [pathname, state]);

  return null;
}