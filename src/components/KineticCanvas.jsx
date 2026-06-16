import { useRef, useEffect, useState } from 'react';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  KINETIC CANVAS — disegno interattivo su Canvas 2D (REFACTOR PRODUZIONE)
 *
 *  Fix applicati (vedi commenti "BUG #n" nel codice):
 *   #1  RAF loop bulletproof: non muore MAI (ripianifica sempre), salta solo il
 *       rendering quando off-screen, ridisegna tutto al rientro. Niente race.
 *   #2  setTransform(1,0,0,1,0,0) prima di scale(dpr): scala mai accumulata.
 *   #3  rect del canvas cachato (resize/scroll/pointerdown), coordinate in CSS px.
 *   #4  pointercancel separato da pointerup (niente releasePointerCapture).
 *   #5  engine inizializzato dentro useEffect + reset nel cleanup → StrictMode-safe.
 *   #6  point pool PER-ISTANZA (niente stato globale condiviso tra istanze).
 *   #7  alloc() azzera tutte le proprietà del punto riciclato.
 *   #8  soglia di scroll verticale su touch: distingue swipe-scroll dal tratto.
 *   #9  reset esplicito dello stato del contesto tra i pass di rendering.
 *   #10 ResizeObserver sul container (non window.resize): rileva ogni cambio reale.
 *   #11 { alpha:false } mantenuto (sfondo opaco) — vedi commento dedicato.
 *   #12 un solo pointer attivo per volta: multi-touch ignorato.
 *   #13 guard difensivo sull'eviction degli stroke (freeAll su array valido).
 *   #14 reset della matrice del contesto nel cleanup.
 *   #15 delta-time normalizzato a 60fps (clampato per pause/throttling/120Hz).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ────────────── COSTANTI ──────────────
const COLORS = [
  '#F0E6D3', // Bianco Crema
  '#4AF626', // Verde Neon
  '#F4A261', // Arancio Accent
  '#00E5FF', // Ciano Cyber
  '#FF0055'  // Rosa Magenta
];

// Dimensioni LUT (potenza di due per il bitmask veloce)
const LUT_SIZE = 4096;
const LUT_MASK = LUT_SIZE - 1;
const INV_TWO_PI = LUT_SIZE / (Math.PI * 2);   // 4096 / 2π

// Pool massimo di punti preallocati
const MAX_POINTS = 4000;
// Numero massimo di stroke mantenuti (i più vecchi vengono riciclati)
const MAX_STROKES = 40;

// Glow senza shadowBlur: spessori e opacità dei pass multipli
const GLOW_DRAWING_LW = 20;
const GLOW_DRAWING_ALPHA = 0.12;
const GLOW_SETTLED_LW = 14;
const GLOW_SETTLED_ALPHA = 0.18;
const GLOW_DOT_RADIUS = 6;
const GLOW_DOT_ALPHA = 0.2;

// BUG #15: clamp del delta-time (in frame da 60fps). Evita che le particelle
// "saltino" dopo una pausa lunga (tab in background, throttling, hitch).
const MAX_DELTA = 3;

// ────────────── HELPERS GLOBALI (mai ricreati) ──────────────
// Pre‑crea tabella coseno e seno in Float32Array (condivisibili: sono read-only)
const cosTab = new Float32Array(LUT_SIZE);
const sinTab = new Float32Array(LUT_SIZE);
for (let i = 0; i < LUT_SIZE; i++) {
  const angle = (i / LUT_SIZE) * Math.PI * 2;
  cosTab[i] = Math.cos(angle);
  sinTab[i] = Math.sin(angle);
}

/**
 * Factory che pre‑alloca un pool di punti e restituisce il gestore.
 * Ogni punto è un oggetto riutilizzato per evitare GC.
 * BUG #6: viene creato PER ISTANZA del componente (via useRef), non come
 * singleton globale → due <KineticCanvas/> sulla stessa pagina non si rubano
 * i punti a vicenda.
 */
function createPointPool(size) {
  const pool = new Array(size);
  const free = new Array(size);
  for (let i = 0; i < size; i++) {
    const p = { x: 0, y: 0, ox: 0, oy: 0, angle: 0, speed: 0, radius: 0, size: 0 };
    pool[i] = p;
    free[i] = p;
  }
  let freeCount = size;

  return {
    /** Preleva un punto dal pool, COMPLETAMENTE azzerato (BUG #7) */
    alloc() {
      if (freeCount === 0) {
        // Fallback: crea un nuovo oggetto (evento raro, pool esaurito)
        return { x: 0, y: 0, ox: 0, oy: 0, angle: 0, speed: 0, radius: 0, size: 0 };
      }
      const p = free[--freeCount];
      // BUG #7: azzera ogni proprietà così un punto riciclato non porta con sé
      // valori residui dall'uso precedente (x/y/ox/oy/angle/speed/radius/size).
      p.x = p.y = p.ox = p.oy = p.angle = p.speed = p.radius = p.size = 0;
      return p;
    },
    /** Restituisce un punto al pool */
    free(p) {
      if (freeCount < size) {
        free[freeCount++] = p;
      }
      // se il pool è pieno lo scartiamo (non succede con MAX_POINTS corretto)
    },
    /** Svuota un intero array di punti restituendoli al pool */
    freeAll(points) {
      if (!points) return; // BUG #13: guard difensivo
      for (let i = 0; i < points.length; i++) {
        this.free(points[i]);
      }
    },
    /**
     * BUG #5: ripristina il pool allo stato "tutto libero". Chiamato nel cleanup
     * così un eventuale remount (StrictMode o render condizionale) riparte con un
     * pool pulito e pieno, senza punti "in prestito" da una vita precedente.
     */
    reset() {
      for (let i = 0; i < size; i++) free[i] = pool[i];
      freeCount = size;
    },
  };
}

// ────────────── COMPONENTE ──────────────
export default function KineticCanvas() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);
  const observerRef = useRef(null);
  const resizeObsRef = useRef(null);
  const isVisibleRef = useRef(true);          // flag IntersectionObserver
  const forceRedrawRef = useRef(true);        // BUG #1: redraw garantito al rientro

  // BUG #6: pool ed engine PER-ISTANZA (niente più variabili a livello di modulo)
  const poolRef = useRef(null);
  const engineRef = useRef(null);

  // BUG #3: rect del canvas cachato → niente getBoundingClientRect ad ogni evento
  const rectRef = useRef(null);

  // BUG #12: un solo pointer disegna per volta
  const activePointerIdRef = useRef(null);

  const [activeColor, setActiveColor] = useState(COLORS[1]);
  const colorRef = useRef(COLORS[1]);

  const changeColor = (color) => {
    setActiveColor(color);
    colorRef.current = color;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // BUG #11: { alpha: false } è CORRETTO qui: ogni frame disegna uno sfondo
    // opaco (#030201) su tutta la superficie e il container ha lo stesso colore
    // di fondo. Non essendoci trasparenza reale, il compositing è più veloce e
    // non si creano artefatti. (Se un giorno il canvas venisse sovrapposto ad
    // altri layer visibili, rimuovere questa opzione.)
    const ctx = canvas.getContext('2d', { alpha: false });

    // BUG #5: inizializzazione DENTRO l'effect → StrictMode-safe. Il pool
    // persiste tra i remount (ref) ma l'engine è SEMPRE nuovo ad ogni mount, e
    // il pool viene resettato nel cleanup: nessuno stato sporco riusato.
    if (!poolRef.current) poolRef.current = createPointPool(MAX_POINTS);
    engineRef.current = {
      strokes: [],
      currentStroke: null,
      isDrawing: false,
      pointPool: poolRef.current,
    };

    // Stato del loop (dichiarato prima degli observer che lo referenziano)
    let dpr = window.devicePixelRatio || 1;
    let cssW = 0;
    let cssH = 0;
    let lastTime = 0;
    let disposed = false;

    // ── Setup dimensionale ──
    const setupCanvas = () => {
      // dpr può cambiare spostando la finestra tra monitor a densità diversa
      dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      cssW = Math.max(1, Math.round(rect.width));
      cssH = Math.max(1, Math.round(rect.height));

      // Impostare width/height resetta il backing store (e in teoria il contesto)
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      // BUG #2: il reset di width/height NON azzera la matrice in modo coerente
      // tra browser. setTransform la SOVRASCRIVE (non concatena): così la scala
      // è esattamente dpr e non si accumula a ogni resize.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      // aggiorna il rect cachato del canvas (BUG #3)
      rectRef.current = canvas.getBoundingClientRect();
      forceRedrawRef.current = true;
    };
    setupCanvas();

    // ── BUG #10: ResizeObserver sul container. Rileva QUALSIASI cambio di
    //    dimensione (layout flex, sidebar, rotazione device, barra mobile),
    //    non solo window.resize. Debounce su rAF per evitare thrash; agisce
    //    solo su variazioni reali per non azzerare il canvas inutilmente. ──
    let resizeRaf = 0;
    const resizeObs = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        if (disposed) return;
        const rect = container.getBoundingClientRect();
        if (Math.round(rect.width) !== cssW || Math.round(rect.height) !== cssH) {
          setupCanvas();
        }
      });
    });
    resizeObs.observe(container);
    resizeObsRef.current = resizeObs;

    // ── BUG #3: il rect cachato deve restare fresco anche durante lo scroll di
    //    pagina (cambia top/left). Listener passivo: nessun costo di blocco. ──
    const refreshRect = () => { rectRef.current = canvas.getBoundingClientRect(); };
    window.addEventListener('scroll', refreshRect, { passive: true });

    // ── Blocco touch nativo (pull‑to‑refresh, pinch) SOLO durante il disegno ──
    const preventTouch = (e) => {
      if (engineRef.current && engineRef.current.isDrawing) e.preventDefault();
    };
    canvas.addEventListener('touchstart', preventTouch, { passive: false });
    canvas.addEventListener('touchmove', preventTouch, { passive: false });

    // ── BUG #1: IntersectionObserver = SOLO un flag di visibilità. Non ferma
    //    né riavvia il RAF (era questa la race condition che svuotava il canvas).
    //    Al rientro: forza il redraw completo e resetta il clock del delta. ──
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          forceRedrawRef.current = true; // primo frame visibile → ridisegna tutto
          lastTime = 0;                  // delta=1 al rientro → nessun salto particelle
          refreshRect();                 // la posizione è cambiata scrollando
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(container);
    observerRef.current = observer;

    // ── LOOP PRINCIPALE — BULLETPROOF (BUG #1 + #15) ──
    const render = (time) => {
      // Non eseguire (né ripianificare) dopo l'unmount: niente frame orfani.
      if (disposed) return;
      // Ripianifica SUBITO: anche se il rendering qui sotto lanciasse, il loop
      // è già schedulato → non può "morire". cancelAnimationFrame nel cleanup
      // ferma comunque questo id.
      animFrameRef.current = requestAnimationFrame(render);

      // BUG #1: off-screen → salta SOLO il rendering, ma il loop resta vivo.
      // (Il browser throttla nativamente il RAF per tab/elementi non visibili,
      //  quindi non c'è overhead reale.) Teniamo aggiornato il clock per non
      //  generare un delta enorme al rientro.
      if (!isVisibleRef.current) {
        lastTime = time;
        return;
      }

      const engine = engineRef.current;
      if (!engine) return;

      // BUG #15: delta-time normalizzato a 60fps. A 120Hz delta≈0.5, a 30fps
      // delta≈2: la velocità orbitale resta costante nel tempo reale. Clamp per
      // evitare salti dopo pause/throttling.
      let delta = lastTime ? (time - lastTime) / 16.666 : 1;
      if (delta > MAX_DELTA) delta = MAX_DELTA;
      if (delta < 0) delta = 0;
      lastTime = time;

      // BUG #1: consuma il flag di redraw forzato. Il loop ridisegna comunque
      // l'intera scena ogni frame visibile (le particelle si muovono di continuo),
      // ma il flag rende esplicita la garanzia di un frame completo al rientro.
      forceRedrawRef.current = false;

      // 1. Sfondo opaco (pulisce il frame precedente)
      ctx.fillStyle = '#030201';
      ctx.fillRect(0, 0, cssW, cssH);

      const { strokes } = engine;
      // Separiamo drawing e settled per fare batch delle API
      const drawingStrokes = [];
      const settledStrokes = [];

      for (let s = 0; s < strokes.length; s++) {
        const stroke = strokes[s];
        if (stroke.state === 'drawing') {
          drawingStrokes.push(stroke);
        } else {
          // Aggiorniamo le posizioni delle particelle (con LUT, zero Math.cos/sin)
          const points = stroke.points;
          for (let i = 0; i < points.length; i++) {
            const p = points[i];
            p.angle += p.speed * delta; // BUG #15: moto indipendente dal framerate
            // Lookup veloce con bitmask
            const idx = (p.angle * INV_TWO_PI) & LUT_MASK;
            p.x = p.ox + cosTab[idx] * p.radius;
            p.y = p.oy + sinTab[idx] * p.radius;
          }
          settledStrokes.push(stroke);
        }
      }

      // BUG #9: ogni pass imposta ESPLICITAMENTE tutti gli stati del contesto che
      // usa (lineWidth, globalAlpha, lineCap/Join, stroke/fillStyle) così nessun
      // valore "sanguina" dal pass precedente o da codice esterno.

      // ─── PASS 1: GLOW LINEE (drawing) ───
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = GLOW_DRAWING_LW;
      ctx.globalAlpha = GLOW_DRAWING_ALPHA;
      for (const stroke of drawingStrokes) {
        ctx.strokeStyle = stroke.color;
        ctx.beginPath();
        const pts = stroke.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }

      // ─── PASS 2: LINEE PRINCIPALI (drawing) ───
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 1;
      for (const stroke of drawingStrokes) {
        ctx.strokeStyle = stroke.color;
        ctx.beginPath();
        const pts = stroke.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }

      // ─── PASS 3: GLOW LINEE (settled) ───
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = GLOW_SETTLED_LW;
      ctx.globalAlpha = GLOW_SETTLED_ALPHA;
      for (const stroke of settledStrokes) {
        ctx.strokeStyle = stroke.color;
        ctx.beginPath();
        const pts = stroke.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }

      // ─── PASS 4: LINEE PRINCIPALI (settled) ───
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      for (const stroke of settledStrokes) {
        ctx.strokeStyle = stroke.color;
        ctx.beginPath();
        const pts = stroke.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }

      // ─── PASS 5: GLOW DEI NODI (settled) ───
      ctx.globalAlpha = GLOW_DOT_ALPHA;
      for (const stroke of settledStrokes) {
        ctx.fillStyle = stroke.color;
        const pts = stroke.points;
        for (let i = 0; i < pts.length; i++) {
          if (i % 5 === 0 || i === pts.length - 1) {
            const p = pts[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, GLOW_DOT_RADIUS, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // ─── PASS 6: NODI PRINCIPALI (settled) ───
      ctx.globalAlpha = 1;
      for (const stroke of settledStrokes) {
        ctx.fillStyle = stroke.color;
        const pts = stroke.points;
        for (let i = 0; i < pts.length; i++) {
          if (i % 5 === 0 || i === pts.length - 1) {
            const p = pts[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // BUG #9: reset finale dello stato globale condiviso
      ctx.globalAlpha = 1;
    };

    // Avvio del loop
    animFrameRef.current = requestAnimationFrame(render);

    // ── PULIZIA TOTALE (StrictMode-safe) ──
    return () => {
      disposed = true;
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
      cancelAnimationFrame(resizeRaf);

      window.removeEventListener('scroll', refreshRect);
      canvas.removeEventListener('touchstart', preventTouch);
      canvas.removeEventListener('touchmove', preventTouch);

      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      if (resizeObsRef.current) { resizeObsRef.current.disconnect(); resizeObsRef.current = null; }

      // BUG #14: azzera la matrice del contesto (nessuna trasformazione residua
      // se il canvas/ctx venisse riusato da un pattern esterno).
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // BUG #5: stato pulito per il prossimo mount.
      if (poolRef.current) poolRef.current.reset();
      engineRef.current = null;
      activePointerIdRef.current = null;
    };
  }, []); // [] eseguito al mount; engine ricreato qui dentro ad ogni (re)mount

  // ── Helper coordinate (BUG #3) ──
  // Usa il rect CACHATO (no getBoundingClientRect per evento). Coordinate in CSS
  // pixel: NON moltiplicate per dpr, perché è ctx.scale(dpr,dpr) a fare lo scaling.
  const getCoordinates = (e) => {
    const rect = rectRef.current || canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // ── Inizializza un punto dal pool alla posizione (x, y) ──
  const spawnPoint = (x, y) => {
    const point = engineRef.current.pointPool.alloc();
    point.ox = point.x = x;
    point.oy = point.y = y;
    point.angle = Math.random() * Math.PI * 2;
    point.speed = Math.random() * 0.05 + 0.02;
    point.radius = Math.random() * 2 + 0.5;
    point.size = Math.random() * 2 + 1;
    return point;
  };

  // ── Finalizza lo stroke corrente + applica il limite stroke (BUG #13) ──
  // Idempotente: se non c'è uno stroke in disegno, garantisce solo isDrawing=false.
  const finalizeCurrentStroke = () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!engine.currentStroke) {
      engine.isDrawing = false;
      return;
    }
    engine.currentStroke.state = 'settled';
    engine.currentStroke = null;
    engine.isDrawing = false;

    const { strokes } = engine;
    if (strokes.length > MAX_STROKES) {
      const removed = strokes.shift();
      // BUG #13: guard prima di restituire i punti al pool
      if (removed && removed.points) engine.pointPool.freeAll(removed.points);
    }
  };

  // ── BUG #4: pointercancel SEPARATO da pointerup ──
  // Il sistema ha già interrotto il tracking (scroll/zoom/chiamata in arrivo) e
  // ha GIÀ rilasciato il capture → NON chiamiamo releasePointerCapture (eviterebbe
  // la DOMException InvalidPointerId). Lo stroke viene comunque finalizzato per
  // non restare in uno stato intermedio.
  const onPointerCancel = (e) => {
    const engine = engineRef.current;
    if (!engine) return;
    // se c'è un pointer attivo diverso da questo, ignora; altrimenti procedi
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    activePointerIdRef.current = null;
    finalizeCurrentStroke();
    // NESSUN releasePointerCapture qui (BUG #4)
  };

  const onPointerDown = (e) => {
    const engine = engineRef.current;
    if (!engine) return;
    // BUG #12: se un pointer sta già disegnando, ignora gli altri (no multi-touch)
    if (activePointerIdRef.current !== null) return;
    activePointerIdRef.current = e.pointerId;

    // BUG #3: rect fresco all'inizio di OGNI interazione (copre scroll tra i tratti)
    if (canvasRef.current) rectRef.current = canvasRef.current.getBoundingClientRect();

    try { canvasRef.current.setPointerCapture(e.pointerId); } catch (err) {}
    engine.isDrawing = true;

    const { x, y } = getCoordinates(e);
    const newStroke = {
      color: colorRef.current,
      state: 'drawing',
      points: [spawnPoint(x, y)],
    };
    engine.currentStroke = newStroke;
    engine.strokes.push(newStroke);
  };

  const onPointerMove = (e) => {
    const engine = engineRef.current;
    if (!engine || !engine.isDrawing || !engine.currentStroke) return;
    // BUG #12: solo il pointer attivo disegna
    if (e.pointerId !== activePointerIdRef.current) return;

    // FIX MOBILE — niente più soglia di scroll. La vecchia logica annullava il
    // tratto al primo spostamento verticale del dito (> 10px): era questo a
    // "non prendere il dito e bloccarsi subito" su mobile. Il canvas ha
    // touchAction:'none' → è una superficie di disegno DEDICATA: ogni movimento
    // del dito è un tratto, mai uno scroll. Nessuna disambiguazione necessaria.
    //
    // ULTRA RESPONSIVE — eventi "coalesced": su touch/penna ad alta frequenza il
    // browser accorpa più campioni in un singolo pointermove. Recuperandoli tutti
    // (getCoalescedEvents) la linea segue il dito 1:1, senza scalettature né
    // ritardo percepito. Fallback al singolo evento dove l'API non esiste.
    const pts = engine.currentStroke.points;
    const samples =
      typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;

    if (samples && samples.length) {
      for (let i = 0; i < samples.length; i++) {
        const { x, y } = getCoordinates(samples[i]);
        pts.push(spawnPoint(x, y));
      }
    } else {
      const { x, y } = getCoordinates(e);
      pts.push(spawnPoint(x, y));
    }
  };

  const onPointerUp = (e) => {
    const engine = engineRef.current;
    if (!engine) return;
    // BUG #12: gestisci solo il pointer attivo
    if (e.pointerId !== activePointerIdRef.current) return;
    activePointerIdRef.current = null;

    finalizeCurrentStroke();
    // pointerup "normale": qui il capture è ancora nostro → rilascio valido
    try { canvasRef.current.releasePointerCapture(e.pointerId); } catch (err) {}
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '500px',
        background: '#030201',
        overflow: 'hidden',
      }}
    >
      {/* Testo di sfondo invariato */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 'clamp(1rem, 4vw, 2.5rem)',
          letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.15)',
          userSelect: 'none',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        [ INTERACT // LASCIA IL SEGNO ]
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
      />

      {/* Selettore colori invariato */}
      <div
        style={{
          position: 'absolute',
          bottom: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 'clamp(0.5rem, 2vw, 1rem)',
          padding: '0.75rem 1.25rem',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '3rem',
          zIndex: 10,
        }}
      >
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => changeColor(color)}
            style={{
              width: 'clamp(32px, 8vw, 40px)',
              height: 'clamp(32px, 8vw, 40px)',
              borderRadius: '50%',
              backgroundColor: color,
              border: activeColor === color ? `3px solid #FFF` : '2px solid rgba(255,255,255,0.1)',
              boxShadow: activeColor === color ? `0 0 20px ${color}` : 'none',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: activeColor === color ? 'scale(1.1)' : 'scale(1)',
            }}
            aria-label={`Scegli colore ${color}`}
          />
        ))}
      </div>
    </div>
  );
}