import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────────────────────────────────────
// ScrollToTop — v4 — "Intent-Aware"
// ─────────────────────────────────────────────────────────────────────────────
//
// PROBLEMA RISOLTO: In v3 questo componente leggeva `state` direttamente
// da useLocation() per decidere se ignorare il reset. Questo creava una
// race condition su mobile:
//
//   T+0ms    navigate("/", { state: { scrollTo: 'contact-section' } })
//   T+4ms    ScrollToTop re-render → legge state, trova scrollTo → OK, salta.
//   T+8ms    App.jsx useEffect → legge location.key → chiama scrollToElementWhenReady
//   T+???ms  [mobile] Suspense risolve, layout si stabilizza
//   T+???ms  scrollToElementWhenReady risolve, chiama lenis.scrollTo(targetY)
//   T+???ms  iOS scroll restoration spara un popstate silenzioso → window.scrollY = 0
//              ↑ su desktop questo non accade perché la finestra non ha perso focus
//
// Il problema NON era in ScrollToTop — era che il "guard" basato su `state`
// funzionava correttamente. Il vero problema era in executeScroll (App.jsx):
// il "lock a 60 frame" calcolava targetY su un layout ancora instabile.
//
// Tuttavia, aggiungiamo un secondo layer di protezione:
//   window.__scrollIntent = { targetId, resolved: false }
//
// È un flag globale scritto da App.jsx PRIMA di chiamare scrollToElementWhenReady,
// e cancellato DOPO che il veil si è alzato.
//
// ScrollToTop controlla questo flag: se è attivo, NON tocca né lo scroll
// né i ScrollTrigger. Questo garantisce che anche un eventuale re-render
// di ScrollToTop durante la transizione non interferisca con il processo.
// ─────────────────────────────────────────────────────────────────────────────

export default function ScrollToTop() {
  const { pathname, state } = useLocation();
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    // ── GUARD 1: flag da location.state (compatibilità con v3) ────────────────
    // Se la navigazione ha un target esplicito o ha chiesto di non resettare,
    // App.jsx gestirà tutto. Usciamo subito.
    if (state?.scrollTo || state?.scrollToWorks || state?.noScrollReset) {
      prevPathRef.current = pathname;
      return;
    }

    // ── GUARD 2: flag globale window.__scrollIntent ────────────────────────────
    // App.jsx imposta questo flag PRIMA di chiamare scrollToElementWhenReady.
    // Se è attivo, una transizione "intent" è in corso e non dobbiamo
    // interferire nemmeno se state fosse già stato consumato da React.
    if (window.__scrollIntent?.active) {
      prevPathRef.current = pathname;
      return;
    }

    // ── RESET STANDARD (cambio di rotta senza intent specifico) ───────────────
    if (pathname !== prevPathRef.current) {
      // Uccidiamo i trigger PRIMA di scrollare per evitare che
      // i pin-spacer in corso di dismissione interferiscano con il reset.
      ScrollTrigger.getAll().forEach((st) => st.kill());

      if (window.__lenis) {
        window.__lenis.scrollTo(0, { immediate: true });
      } else {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }

      prevPathRef.current = pathname;

      // Cascade refresh progressivo — i Suspense lazy si idratano in ritardo.
      // Tre refresh coprono i casi di: idratazione rapida, lenta, e immagini lazy.
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