/**
 * Preloader.jsx — "THE BIRTH OF AN IDENTITY" (v11.0)
 * ══════════════════════════════════════════════════════════════════════════
 * Non è una schermata di caricamento. È la nascita di un'identità: un'unica
 * inquadratura tipografica, senza stacchi, dalla prima lettera allo
 * svelamento della homepage.
 *
 *   S  →  SEBASTIANO  →  MOLLO  →  le due O si aprono  →  homepage
 *
 * Durata complessiva ≈ 6.4s. Nero assoluto, bianco puro, nient'altro:
 * niente gradienti, texture, particelle, grana, ombre, bagliori.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * COME FUNZIONA (le tre idee che reggono tutto)
 * ──────────────────────────────────────────────────────────────────────────
 * 1 — LAYOUT PRECALCOLATO, ANIMAZIONE A COSTO ZERO.
 *     Le lettere vengono misurate UNA volta a font caricato, poi posizionate
 *     in assoluto agli offset definitivi. Da quel momento l'intera sequenza
 *     è solo `transform`: nessun reflow, nessuna lettura di layout nel loop,
 *     nessun `width` animato. Un solo tween pilota un valore numerico e una
 *     funzione scrive le trasformazioni delle 10 lettere per frame.
 *
 * 2 — LA CRESCITA NON È UN'APPARIZIONE.
 *     Ogni lettera si apre da larghezza zero con origine a sinistra, mentre
 *     l'intero blocco si riscala e si ricentra in continuo. Nulla entra da
 *     fuori, nulla sfuma: la parola si estende, e la scala compensa perché
 *     resti sempre incorniciata allo stesso modo. È il motivo per cui la S
 *     gigante e SEBASTIANO monumentale hanno la stessa presenza ottica.
 *
 * 3 — LE O NON DIVENTANO MASCHERE: LO SONO GIÀ.
 *     Lo svelamento finale non aggiunge cerchi sopra le lettere. Sono le
 *     CONTROFORME delle due O — il loro vuoto interno — ad aprirsi e a
 *     mangiarsi il nero, inghiottendo anche le altre lettere. Il buco parte
 *     esattamente dal raggio della controforma, quindi non c'è nessun
 *     istante in cui si veda un elemento nuovo comparire.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * DUE LIMITI DICHIARATI, NON NASCOSTI
 * ──────────────────────────────────────────────────────────────────────────
 * [L1] IL MORPH NON È INTERPOLAZIONE DI TRACCIATI.
 *      Interpolare davvero il contorno di una S in quello di una M richiede
 *      i path vettoriali dei glifi e un motore di morphing (MorphSVGPlugin,
 *      a pagamento — verificato: nel progetto non c'è). Senza quello, un
 *      "morph" fatto di dissolvenze sarebbe esattamente ciò che il brief
 *      vieta. Qui la trasformazione è geometrica e sempre nitida:
 *        · le lettere che non sopravvivono si comprimono a zero collassando
 *          verso la vicina che resta (il brief: "fold into neighboring forms");
 *        · le lettere che cambiano identità si riformano con una lama
 *          orizzontale che scende: sopra la linea c'è già la nuova forma,
 *          sotto c'è ancora la vecchia. Nessuna opacità, nessuna doppia
 *          immagine, ogni fotogramma leggibile.
 *      Se vuoi l'interpolazione vera dei contorni si può fare estraendo i
 *      path dal font con opentype.js in fase di build: dimmelo e la aggiungo.
 *
 * [L2] L'AUDIO AL PRIMO CARICAMENTO SARÀ QUASI SEMPRE MUTO.
 *      Tutti i browser bloccano l'audio finché l'utente non ha interagito
 *      con la pagina: al primo ingresso non c'è stata alcuna interazione,
 *      quindi l'AudioContext nasce sospeso. Qui il suono è sintetizzato in
 *      tempo reale con la Web Audio API (zero file da scaricare) e viene
 *      riprodotto SOLO se il browser lo concede; altrimenti la sequenza
 *      prosegue identica, in silenzio, senza errori in console. Non è
 *      aggirabile senza chiedere un click prima dell'intro.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * TIPOGRAFIA
 * ──────────────────────────────────────────────────────────────────────────
 * Lo stack cerca prima i grotesque editoriali del brief (Neue Haas Grotesk
 * Display, PP Neue Montreal, Suisse Int'l, ABC Diatype): se un giorno ne
 * self-hosti uno, viene adottato senza toccare il codice. Il fallback reale
 * è Outfit 900, l'unico peso ultra-bold già caricato dal sito — verificato
 * in index.html. La sequenza attende `document.fonts.ready` prima di
 * mostrare la S: altrimenti il primo fotogramma userebbe un ripiego di
 * sistema e la lettera cambierebbe forma sotto gli occhi.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ACCESSIBILITÀ E CONTROLLO
 * ──────────────────────────────────────────────────────────────────────────
 * · prefers-reduced-motion: nessun tween, nessun audio. Mostra la parola
 *   finale per mezzo secondo e cede il passo alla homepage.
 * · Click, Esc, Invio o Spazio saltano subito allo svelamento.
 * · SKIP_IF_SEEN (in cima al file): se lo porti a true, l'intro va per
 *   intero solo la prima volta nella sessione. Lasciato su false perché è
 *   una scelta editoriale, non tecnica.
 * · Guardia anti doppio-avvio per React StrictMode.
 */

import { useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';

/* ══════════════════════════════════════════════════════════════════════════
   CONFIGURAZIONE
══════════════════════════════════════════════════════════════════════════ */

const SOURCE = 'SEBASTIANO';

/* Mappa posizionale: per ogni lettera di SEBASTIANO, cosa diventa.
   null = si ripiega nella vicina che sopravvive.
      S → M      E ✕      B ✕      A → O      S ✕
      T → L      I ✕      A → L      N ✕      O → O (unica superstite reale)
   L'ordine dei superstiti dà esattamente M-O-L-L-O. */
const MORPH_MAP = ['M', null, null, 'O', null, 'L', null, 'L', null, 'O'];

/* Indici delle due O finali: da qui nascono le maschere. */
const O_SLOTS = [3, 9];

const TYPE_STACK =
  "'Neue Haas Grotesk Display','PP Neue Montreal','Suisse Intl','ABC Diatype','Outfit','Helvetica Neue',system-ui,sans-serif";

const MEASURE_PX = 200;   // font-size di misurazione: più alto = misure più precise
const TRACKING = -0.055;  // crenatura strettissima, in em
const FIT_W = 0.86;       // quota di larghezza viewport occupata dal blocco
const FIT_H = 0.58;       // tetto di altezza: impedisce alla S sola di sfondare

/* Portalo a true per far vedere l'intro solo alla prima visita della sessione. */
const SKIP_IF_SEEN = false;
const SEEN_KEY = 'sm_identity_seen';

/* Curve: nessun rimbalzo, nessun overshoot. Accelerazione impercettibile,
   decelerazione lunghissima — il movimento del marmo, non della gomma. */
const E = {
  grow:  'power3.inOut',
  morph: 'power2.inOut',
  mask:  'power4.inOut',
  soft:  'power2.out',
};

const T = {
  blackHold:  0.25,  // silenzio iniziale
  breathIn:   0.95,  // inizio del respiro
  growStart:  1.15,
  growDur:    2.20,
  stabilize:  0.60,
  morphDur:   1.30,
  oHold:      0.42,
  maskDur:    0.95,
};

/* Istante in cui comincia lo svelamento: serve anche allo skip. */
const MASK_AT = T.growStart + T.growDur + T.stabilize + T.morphDur + T.oHold;

/* ══════════════════════════════════════════════════════════════════════════
   AUDIO — sintesi Web Audio, zero asset. Silenzioso se il browser blocca.
══════════════════════════════════════════════════════════════════════════ */
function createAudio() {
  let ctx = null;
  let master = null;
  let drone = null;
  let blocked = false;

  const init = () => {
    if (ctx || blocked) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { blocked = true; return null; }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Se il browser non concede l'audio il contesto resta 'suspended':
      // resume() fallisce in silenzio e tutto il resto diventa no-op.
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {
      blocked = true;
      ctx = null;
    }
    return ctx;
  };

  const ready = () => {
    const c = init();
    return c && c.state === 'running' ? c : null;
  };

  /* Colpo sub analogico: il marmo appoggiato a terra. */
  const subHit = (freq = 46, dur = 1.5, vol = 0.55) => {
    const c = ready(); if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.9, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq, c.currentTime + 0.22);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    osc.connect(g); g.connect(master);
    osc.start(); osc.stop(c.currentTime + dur + 0.05);
  };

  /* Click tattile: rumore filtrato strettissimo, quasi un movimento di carta. */
  const tick = (vol = 0.10) => {
    const c = ready(); if (!c) return;
    const len = Math.floor(c.sampleRate * 0.035);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5);
    }
    const src = c.createBufferSource();
    const bp = c.createBiquadFilter();
    const g = c.createGain();
    src.buffer = buf;
    bp.type = 'bandpass';
    bp.frequency.value = 1600 + Math.random() * 900;
    bp.Q.value = 3.2;
    g.gain.value = vol;
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start();
  };

  /* Drone caldo: due oscillatori appena disaccordati, nessuna melodia. */
  const startDrone = () => {
    const c = ready(); if (!c || drone) return;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.09, c.currentTime + 2.4);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const a = c.createOscillator();
    const b = c.createOscillator();
    a.type = 'sine'; a.frequency.value = 55;
    b.type = 'sine'; b.frequency.value = 55.6; // battimento lentissimo
    a.connect(lp); b.connect(lp); lp.connect(g); g.connect(master);
    a.start(); b.start();
    drone = { a, b, g };
  };

  const stopDrone = (fade = 0.8) => {
    const c = ready(); if (!c || !drone) return;
    try {
      drone.g.gain.cancelScheduledValues(c.currentTime);
      drone.g.gain.setValueAtTime(drone.g.gain.value || 0.0001, c.currentTime);
      drone.g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + fade);
      drone.a.stop(c.currentTime + fade + 0.1);
      drone.b.stop(c.currentTime + fade + 0.1);
    } catch { /* già fermato */ }
    drone = null;
  };

  /* Braam trattenuto: autorità, non trailer. */
  const braam = () => {
    const c = ready(); if (!c) return;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.42, c.currentTime + 0.32);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 2.1);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(180, c.currentTime);
    lp.frequency.linearRampToValueAtTime(520, c.currentTime + 0.5);
    [36, 54, 72, 108].forEach((f, i) => {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      og.gain.value = 1 / (i + 1.4);
      o.connect(og); og.connect(lp);
      o.start(); o.stop(c.currentTime + 2.2);
    });
    lp.connect(g); g.connect(master);
  };

  const dispose = () => {
    stopDrone(0.05);
    if (ctx) { try { ctx.close(); } catch { /* già chiuso */ } }
    ctx = null; master = null;
  };

  /* Se l'utente tocca lo schermo durante l'intro, il browser sblocca
     l'audio: da quel momento i suoni successivi si sentono. */
  const unlock = () => {
    const c = init();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  };

  return { subHit, tick, startDrone, stopDrone, braam, dispose, unlock };
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPONENTE
══════════════════════════════════════════════════════════════════════════ */
export default function Preloader({ onComplete }) {
  const rootRef = useRef(null);
  const wordRef = useRef(null);
  const slotRefs = useRef([]);
  const srcRefs = useRef([]);
  const dstRefs = useRef([]);

  const audioRef = useRef(null);
  const tlRef = useRef(null);
  const startedRef = useRef(false);   // guardia StrictMode
  const finishedRef = useRef(false);
  const layoutRef = useRef(null);     // misure precalcolate

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* storage negato */ }
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (startedRef.current) return undefined;
    startedRef.current = true;

    const root = rootRef.current;
    const word = wordRef.current;
    if (!root || !word) return undefined;

    let reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { reduced = false; }

    let seen = false;
    if (SKIP_IF_SEEN) {
      try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch { seen = false; }
    }

    const slots = slotRefs.current;
    const srcs = srcRefs.current;

    /* ── MISURAZIONE ─────────────────────────────────────────────────────
       Le lettere sono in assoluto e si auto-dimensionano: basta leggere il
       loro rettangolo una volta sola, a font caricato. Da qui in poi non si
       tocca più il layout. */
    const measure = () => {
      const trackPx = TRACKING * MEASURE_PX;

      const srcW = srcs.map((el) => (el ? el.getBoundingClientRect().width : 0));
      const dstW = SOURCE.split('').map((_, i) => {
        const el = dstRefs.current[i];
        return el ? el.getBoundingClientRect().width : 0;
      });

      // offset cumulativi della parola di partenza
      const srcX = [];
      let acc = 0;
      for (let i = 0; i < srcW.length; i++) {
        srcX.push(acc);
        acc += srcW[i] + trackPx;
      }
      const srcTotal = Math.max(acc - trackPx, 1);

      // offset della parola d'arrivo: solo i superstiti occupano spazio
      const dstX = new Array(srcW.length).fill(0);
      let acc2 = 0;
      for (let i = 0; i < srcW.length; i++) {
        if (MORPH_MAP[i]) {
          dstX[i] = acc2;
          acc2 += dstW[i] + trackPx;
        }
      }
      const dstTotal = Math.max(acc2 - trackPx, 1);

      // chi si ripiega collassa verso il superstite successivo (o precedente)
      for (let i = 0; i < srcW.length; i++) {
        if (MORPH_MAP[i]) continue;
        let j = i + 1;
        while (j < srcW.length && !MORPH_MAP[j]) j++;
        if (j >= srcW.length) {
          j = i - 1;
          while (j >= 0 && !MORPH_MAP[j]) j--;
        }
        dstX[i] = (j >= 0 && j < srcW.length) ? dstX[j] : 0;
      }

      const glyphH = srcs[0] ? srcs[0].getBoundingClientRect().height : MEASURE_PX;

      layoutRef.current = { srcW, dstW, srcX, dstX, srcTotal, dstTotal, glyphH };

      // posizionamento definitivo: da ora ogni lettera ha il suo posto
      slots.forEach((el, i) => { if (el) el.style.left = `${srcX[i]}px`; });
      word.style.width = `${srcTotal}px`;
      word.style.height = `${glyphH}px`;
    };

    /* Scala e traslazione del blocco per una data larghezza visibile.
       Con transform-origin a sinistra: schermo = centro + a + s * p,
       quindi per centrare la porzione visibile serve a = -s * V / 2. */
    const fit = (visibleW) => {
      const L = layoutRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const s = Math.min((FIT_W * vw) / visibleW, (FIT_H * vh) / L.glyphH);
      return { s, a: -(s * visibleW) / 2 };
    };

    const applyWord = (visibleW) => {
      const { s, a } = fit(visibleW);
      word.style.transform = `translate3d(${a}px, -50%, 0) scale(${s})`;
    };

    /* ── STATO DI CRESCITA ───────────────────────────────────────────────
       Un solo numero `n` (quante lettere sono aperte, con decimali) governa
       tutto: le scale delle 10 lettere e la trasformazione del blocco. */
    const growth = { n: 1 };
    let lastTick = 1;

    const renderGrowth = () => {
      const L = layoutRef.current;
      if (!L) return;
      const n = growth.n;
      const full = Math.floor(n);
      const frac = n - full;

      for (let i = 0; i < slots.length; i++) {
        if (!slots[i]) continue;
        let sx;
        if (i < full) sx = 1;
        else if (i === full) sx = frac;
        else sx = 0;
        slots[i].style.transform = `scaleX(${sx})`;
      }

      const visible =
        full >= L.srcW.length
          ? L.srcTotal
          : L.srcX[full] + L.srcW[full] * frac;

      applyWord(Math.max(visible, 1));

      // un click tattile a ogni lettera che si apre
      const reached = Math.floor(n);
      if (reached > lastTick) {
        lastTick = reached;
        audioRef.current?.tick(0.085);
      }
    };

    /* ── STATO DI MORPH ──────────────────────────────────────────────────
       `p` da 0 a 1: le lettere si spostano verso le posizioni finali, le
       superflue si comprimono, quelle che cambiano identità si riformano
       sotto una lama che scende. */
    const morph = { p: 0 };

    const renderMorph = () => {
      const L = layoutRef.current;
      if (!L) return;
      const p = morph.p;

      for (let i = 0; i < slots.length; i++) {
        if (!slots[i]) continue;
        const dx = (L.dstX[i] - L.srcX[i]) * p;
        const survives = Boolean(MORPH_MAP[i]);
        const sx = survives ? 1 : 1 - p;
        slots[i].style.transform = `translate3d(${dx}px,0,0) scaleX(${sx})`;

        if (survives && dstRefs.current[i] && MORPH_MAP[i] !== SOURCE[i]) {
          // lama orizzontale: sopra la nuova forma, sotto la vecchia
          const cut = (p * 100).toFixed(2);
          if (srcRefs.current[i]) srcRefs.current[i].style.clipPath = `inset(${cut}% 0% 0% 0%)`;
          dstRefs.current[i].style.clipPath = `inset(0% 0% ${(100 - p * 100).toFixed(2)}% 0%)`;
        }
      }

      const visible = L.srcTotal + (L.dstTotal - L.srcTotal) * p;
      applyWord(Math.max(visible, 1));
    };

    /* ── MASCHERA FINALE ─────────────────────────────────────────────────
       Le controforme delle due O si aprono. Due gradienti radiali con i
       centri sulle O; l'intersezione lascia opaco solo ciò che sta fuori da
       entrambi i cerchi. Il raggio è scritto da GSAP frame per frame, quindi
       non serve @property e funziona anche dove non è supportata. */
    const maskState = { r: 0 };
    let maskCenters = null;
    let maskMode = 'dual';

    const supportsDualMask = () => {
      try {
        return Boolean(
          typeof CSS !== 'undefined' &&
          CSS.supports &&
          (CSS.supports('mask-composite', 'intersect') ||
            CSS.supports('-webkit-mask-composite', 'source-in'))
        );
      } catch { return false; }
    };

    const captureCenters = () => {
      // unica lettura di layout dell'intera sequenza, fatta una volta sola
      maskCenters = O_SLOTS.map((i) => {
        const el = dstRefs.current[i] || srcRefs.current[i];
        const r = el.getBoundingClientRect();
        return {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          r: Math.max(Math.min(r.width, r.height) * 0.24, 4),
        };
      });
      maskMode = supportsDualMask() ? 'dual' : 'single';
      return maskCenters;
    };

    const renderMask = () => {
      if (!maskCenters) return;
      const rr = Math.max(maskState.r, 0);

      if (maskMode === 'single') {
        /* Ripiego per browser senza mask-composite: un unico gradiente
           radiale centrato fra le due O. Stessa idea, un buco solo. */
        const cx = (maskCenters[0].x + maskCenters[1].x) / 2;
        const cy = (maskCenters[0].y + maskCenters[1].y) / 2;
        const layer = `radial-gradient(circle at ${cx}px ${cy}px, transparent ${rr}px, #000 ${rr + 0.5}px)`;
        root.style.webkitMaskImage = layer;
        root.style.maskImage = layer;
        return;
      }

      const layers = maskCenters
        .map((c) => `radial-gradient(circle at ${c.x}px ${c.y}px, transparent ${rr}px, #000 ${rr + 0.5}px)`)
        .join(', ');
      root.style.webkitMaskImage = layers;
      root.style.maskImage = layers;
      root.style.webkitMaskComposite = 'source-in';
      root.style.maskComposite = 'intersect';
    };

    /* ── SEQUENZA ────────────────────────────────────────────────────────── */
    const run = () => {
      measure();
      applyWord(layoutRef.current.srcW[0]); // la S, sola, già inquadrata
      renderGrowth();

      if (reduced || seen) {
        // niente movimento: parola finale, un attimo, e via
        growth.n = SOURCE.length;
        renderGrowth();
        morph.p = 1;
        renderMorph();
        word.style.visibility = 'visible';
        gsap.delayedCall(reduced ? 0.5 : 0.25, () => {
          gsap.to(root, { opacity: 0, duration: 0.45, ease: E.soft, onComplete: finish });
        });
        return;
      }

      audioRef.current = createAudio();

      const tl = gsap.timeline({ onComplete: finish });
      tlRef.current = tl;

      /* SCENA 1 — il nero, poi la S. Nessuna transizione: esiste e basta. */
      tl.call(() => {
        word.style.visibility = 'visible';
        audioRef.current?.subHit(46, 1.6, 0.55);
      }, null, T.blackHold);

      /* SCENA 2 — il respiro: deformazione dell'1%, gomma pesante.
         Agisce su un wrapper interno per non entrare in conflitto con la
         matrice di scala/traslazione che governa l'inquadratura. */
      tl.to('.pl-breath', {
        scaleX: 1.006,
        scaleY: 0.994,
        duration: 1.6,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      }, T.breathIn);

      /* SCENA 3 — la parola cresce dall'interno della S. */
      tl.to(growth, {
        n: SOURCE.length,
        duration: T.growDur,
        ease: E.grow,
        onUpdate: renderGrowth,
      }, T.growStart);

      tl.call(() => audioRef.current?.startDrone(), null, T.growStart + 0.2);

      /* SCENA 4 — stabilizzazione: fermo, solo il respiro. */
      const morphAt = T.growStart + T.growDur + T.stabilize;

      /* SCENA 5 — il morph verso MOLLO. */
      tl.to(morph, {
        p: 1,
        duration: T.morphDur,
        ease: E.morph,
        onUpdate: renderMorph,
        onStart: () => audioRef.current?.tick(0.14),
      }, morphAt);

      /* SCENA 6 — le due O si aprono. */
      tl.call(() => {
        const pts = captureCenters();
        maskState.r = pts[0].r;
        renderMask();
        root.style.pointerEvents = 'none'; // da qui la homepage è già viva
        audioRef.current?.subHit(38, 2.2, 0.5);
        audioRef.current?.stopDrone(0.9);
      }, null, MASK_AT - 0.05);

      tl.to(maskState, {
        r: () => Math.hypot(window.innerWidth, window.innerHeight) * 1.05,
        duration: T.maskDur,
        ease: E.mask,
        onUpdate: renderMask,
      }, MASK_AT);

      /* SCENA 7 — la homepage vive. */
      tl.call(() => audioRef.current?.braam(), null, MASK_AT + 0.12);
    };

    /* Il font DEVE essere pronto prima del primo fotogramma: la S non può
       comparire con un ripiego di sistema e cambiare forma un istante dopo.
       Oltre 1.8s non si aspetta più: meglio un glifo di ripiego che una
       pagina nera immobile. */
    let cancelled = false;
    const startWhenFontReady = () => {
      if (cancelled || tlRef.current) return;
      run();
    };

    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      const guard = window.setTimeout(startWhenFontReady, 1800);
      document.fonts
        .load(`900 ${MEASURE_PX}px Outfit`)
        .catch(() => {})
        .then(() => document.fonts.ready)
        .then(() => { window.clearTimeout(guard); startWhenFontReady(); })
        .catch(() => { window.clearTimeout(guard); startWhenFontReady(); });
    } else {
      startWhenFontReady();
    }

    /* ── SKIP + sblocco audio ──────────────────────────────────────────── */
    const skip = () => {
      audioRef.current?.unlock();
      const tl = tlRef.current;
      if (!tl) return;
      if (tl.time() < MASK_AT - 0.05) tl.time(MASK_AT - 0.05, false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') skip();
    };
    root.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', onKey);

    /* Il riquadro cambia (rotazione, resize): ricalcola scala e centri. */
    const onResize = () => {
      if (!layoutRef.current) return;
      if (morph.p > 0) renderMorph(); else renderGrowth();
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      cancelled = true;
      root.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      tlRef.current?.kill();
      tlRef.current = null;
      gsap.killTweensOf([growth, morph, maskState, word, '.pl-breath']);
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, [finish]);

  return (
    <div ref={rootRef} className="pl-root" role="presentation">
      <div className="pl-stage">
        <div ref={wordRef} className="pl-word">
          <div className="pl-breath">
            {SOURCE.split('').map((ch, i) => (
              <span
                key={i}
                className="pl-slot"
                ref={(el) => { slotRefs.current[i] = el; }}
              >
                <span
                  className="pl-glyph"
                  ref={(el) => { srcRefs.current[i] = el; }}
                >
                  {ch}
                </span>

                {MORPH_MAP[i] ? (
                  <span
                    className="pl-glyph pl-glyph-dst"
                    ref={(el) => { dstRefs.current[i] = el; }}
                  >
                    {MORPH_MAP[i]}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Il nome resta leggibile dagli screen reader anche se visivamente
          è una sequenza di glifi in trasformazione. */}
      <span className="pl-sr">Sebastiano Mollo</span>

      <style>{`
        .pl-root {
          position: fixed;
          top: 0; left: 0;
          width: 100%;
          height: 100%;
          z-index: 9999;
          background: #000000;
          overflow: hidden;
          /* nessun bordo, nessuna ombra, nessuna texture: solo nero */
        }

        .pl-stage {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
        }

        .pl-word {
          position: absolute;
          top: 0;
          left: 0;
          transform-origin: 0% 50%;
          visibility: hidden;      /* la S non esiste prima del suo istante */
          white-space: nowrap;
          will-change: transform;
        }

        /* wrapper del respiro: separato dalla matrice di inquadratura,
           così le due animazioni non si sovrascrivono a vicenda */
        .pl-breath {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          transform-origin: 0% 50%;
        }

        .pl-slot {
          position: absolute;
          top: 0;
          left: 0;
          display: block;
          transform-origin: 0% 50%;
          will-change: transform;
        }

        .pl-glyph {
          display: block;
          font-family: ${TYPE_STACK};
          font-weight: 900;
          font-size: ${MEASURE_PX}px;
          line-height: 1;
          letter-spacing: 0;
          color: #FFFFFF;
          white-space: pre;
          /* la crenatura la calcoliamo noi: il font non deve intromettersi */
          font-kerning: none;
          font-variant-ligatures: none;
          -webkit-font-smoothing: antialiased;
        }

        /* la forma d'arrivo sta esattamente sopra quella di partenza:
           stessa scatola, stesso baseline, nessuno scarto */
        .pl-glyph-dst {
          position: absolute;
          top: 0;
          left: 0;
          clip-path: inset(0% 0% 100% 0%);
        }

        .pl-sr {
          position: absolute;
          width: 1px; height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </div>
  );
}