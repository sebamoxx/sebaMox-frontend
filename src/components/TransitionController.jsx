import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/* ════════════════════════════════════════════════════════════════════
   TRANSITION CONTROLLER — "Page Transition Lock" globale
   ────────────────────────────────────────────────────────────────────
   PROBLEMA: durante il cambio rotta React smonta la pagina, l'altezza
   del documento collassa, il browser clampa scrollY e spara un evento
   scroll "fantasma". Lenis (ancora attivo) e gli ScrollTrigger della
   pagina morente reagiscono a coordinate senza senso mentre i
   pin-spacer spariscono → flickering e glitch.

   SOLUZIONE — handshake in 6 fasi:
     1. LOCK    : lenis.stop() + disable di tutti gli ScrollTrigger
                  (senza revert → zero salti visivi). Da questo momento
                  NESSUNO reagisce più agli eventi di scroll.
     2. EXIT    : (opzionale) l'animazione di uscita gira su un DOM
                  congelato — niente ricalcoli concorrenti.
     3. NAVIGATE: React Router smonta/monta in pace. Il clamp dello
                  scrollY avviene, ma cade nel vuoto: tutto è freezato.
     4. SETTLE  : si attende il layout stabile della nuova rotta
                  (ResizeObserver su body — stessa filosofia della
                  pipeline scroll-to-section già in App.jsx).
     5. RESET   : posizionamento iniziale in immediate-mode A TRIGGER
                  ANCORA SPENTI → il "reset della scrollbar" è
                  letteralmente invisibile, nessuno scatto possibile.
     6. RESUME  : lenis.resize() + lenis.start() + ScrollTrigger
                  re-enable + refresh sul layout definitivo.

   INTEGRAZIONE CON LO SCROLL-TO-SECTION ESISTENTE:
   se la navigazione trasporta un target di sezione (location.state
   .scrollTo / .scrollToWorks oppure il flag sessionStorage), il
   controller SALTA il reset-to-top della fase 5: la posizione resta
   di proprietà esclusiva della pipeline veil+scrollToElementWhenReady
   della HomePage. Il lock si limita a fare da cornice (freeze/resume),
   quindi zero conflitti e zero doppi scroll.

   GSAP TICKER: in main.jsx Lenis è già guidato da gsap.ticker
   (gsap.ticker.add(t => lenis.raf(t*1000))). Non serve toccarlo:
   lenis.stop() rende lenis.raf() un no-op interno, quindi il ticker
   continua a girare per le animazioni GSAP (inclusa quella di exit)
   mentre lo scroll è congelato. stop()/start() È la sincronizzazione.

   NAVIGAZIONI NON GESTITE (back/forward, link esterni al hook):
   il controller interviene SOLO sulle navigazioni partite da
   transitionNavigate. Se locked=false, l'unlock è un no-op: il
   comportamento attuale di back/forward resta identico.
════════════════════════════════════════════════════════════════════ */

/* ── Stato del singleton (module-scope: nessun re-render React) ──── */
const state = {
  locked: false,
  safetyTimer: 0,
};

/* ── Helper: attende che il body smetta di cambiare altezza ────────
   Stessa strategia di waitForStableLayout in App.jsx (ResizeObserver,
   risolve dopo `stableMs` consecutivi senza variazioni).            */
function waitForStableLayout(stableMs = 120, maxWait = 4000) {
  return new Promise((resolve) => {
    let timer = null;
    let done  = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      ro.disconnect();
      resolve();
    };
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(finish, stableMs);
    });
    ro.observe(document.body);
    timer = setTimeout(finish, stableMs);
    setTimeout(finish, maxWait);
  });
}

/* ── Helper: scroll immediato Lenis-aware (unico punto di contatto) */
function hardScrollTo(y) {
  if (window.__lenis) {
    window.__lenis.scrollTo(y, { immediate: true, duration: 0, force: true });
    return;
  }
  try { window.scrollTo({ top: y, behavior: 'instant' }); }
  catch { window.scrollTo(0, y); }
}

/* ═══════════════════════════════════════════════════════════════
   FASE 1 — LOCK
═══════════════════════════════════════════════════════════════ */
export function lockTransition() {
  if (state.locked) return;
  state.locked = true;

  /* Lenis: stop() congela input wheel/touch E rende lenis.raf()
     un no-op — il gsap.ticker continua a girare per le animazioni
     ma lo scroll smette di esistere. */
  window.__lenis?.stop();

  /* ScrollTrigger: disable(false) = congela SENZA revert →
     pin e transform restano dove sono, zero salto visivo.
     Da qui i trigger ignorano qualsiasi evento scroll fantasma
     generato dal clamp durante lo smontaggio. */
  ScrollTrigger.getAll().forEach(t => t.disable(false));

  /* Rete di sicurezza: se l'unlock non arrivasse mai (es. navigate
     verso la stessa rotta → location non cambia → l'effect non
     scatta), lo scroll si sblocca da solo dopo 3.5s. */
  clearTimeout(state.safetyTimer);
  state.safetyTimer = setTimeout(() => unlockTransition({ skipTopReset: true }), 3500);
}

/* ═══════════════════════════════════════════════════════════════
   FASI 4-6 — SETTLE → RESET → RESUME
═══════════════════════════════════════════════════════════════ */
export async function unlockTransition({ skipTopReset = false } = {}) {
  if (!state.locked) return; // navigazioni non gestite: no-op totale
  clearTimeout(state.safetyTimer);

  /* FASE 4 — il DOM della nuova rotta deve smettere di muoversi
     (lazy chunk montato, immagini con dimensioni, font swap fatto) */
  await waitForStableLayout();

  /* FASE 5 — reset silenzioso: avviene PRIMA di riaccendere
     trigger e Lenis → nessun osservatore può reagire → zero scatti.
     Saltato se una pipeline scroll-to-section possiede la posizione. */
  if (!skipTopReset) hardScrollTo(0);

  /* FASE 6 — resume ordinato:
     a) resize: Lenis rilegge i bounds del documento nuovo
     b) start: lo scroll torna vivo
     c) enable dei trigger sopravvissuti (quelli della vecchia pagina
        sono già morti con il cleanup dei componenti; quelli nuovi
        nascono già enabled — il loop è una rete di sicurezza per
        eventuali trigger globali congelati in fase 1)
     d) refresh(true): ricalcolo completo sul layout definitivo     */
  const lenis = window.__lenis;
  if (lenis) { lenis.resize(); lenis.start(); }
  ScrollTrigger.getAll().forEach(t => t.enable(false));
  ScrollTrigger.refresh(true);

  state.locked = false;
}

/* ═══════════════════════════════════════════════════════════════
   HOOK — useTransitionNavigate
   ───────────────────────────────────────────────────────────────
   Drop-in replacement di useNavigate per le navigazioni interne.

   const tNavigate = useTransitionNavigate();
   tNavigate('/works');
   tNavigate('/', { state: { scrollTo: 'sezione-lavori' } });
   tNavigate('/contact', { onExit: () => myExitTimeline().then() });

   `onExit` (opzionale): funzione che ritorna una Promise — tipicamente
   un tween GSAP di uscita: () => gsap.to(el, {...}).then()
   Gira a mondo già congelato (fase 2) e SOLO al suo resolve parte
   il cambio rotta. Se lancia, si naviga comunque (fail-safe).
═══════════════════════════════════════════════════════════════ */
export function useTransitionNavigate() {
  const navigate = useNavigate();

  return useCallback(async (to, opts = {}) => {
    if (state.locked) return; // anti doppio-click durante una transizione
    const { onExit, ...navOpts } = opts;

    lockTransition();                                   // FASE 1

    if (typeof onExit === 'function') {                 // FASE 2
      try { await onExit(); } catch (_) { /* fail-safe: si naviga comunque */ }
    }

    /* Doppio rAF: lo stato di lock si assesta (stop di Lenis
       processato, trigger disabilitati e painted) prima che React
       inizi a smontare. È il punto esatto dell'handshake.          */
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    navigate(to, navOpts);                              // FASE 3
  }, [navigate]);
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE — <TransitionLock />
   ───────────────────────────────────────────────────────────────
   Montalo UNA volta dentro <BrowserRouter>, accanto a <ScrollToTop/>.
   Osserva il cambio di location e completa l'handshake (fasi 4-6).
═══════════════════════════════════════════════════════════════ */
export function TransitionLock() {
  const location = useLocation();
  const firstRun = useRef(true);

  useEffect(() => {
    /* Primo mount = atterraggio iniziale, non una transizione */
    if (firstRun.current) { firstRun.current = false; return; }

    /* Una sezione è in attesa? Controlla ENTRAMBI i canali:
       - location.state (pipeline veil della HomePage)
       - sessionStorage (flag legacy scroll-to-section)
       Se sì: la posizione appartiene a quella pipeline, il
       controller fa solo da cornice freeze/resume.               */
    const sectionPending =
      !!location.state?.scrollTo ||
      !!location.state?.scrollToWorks ||
      sessionStorage.getItem('scrollToWorks') === 'true';

    unlockTransition({ skipTopReset: sectionPending });
  }, [location]);

  return null;
}