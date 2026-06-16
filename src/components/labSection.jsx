/**
 * LabSection.jsx — "IL LABORATORIO" (v2.0 — riscrittura totale)
 * ═══════════════════════════════════════════════════════════════════════════
 * DIREZIONE ARTISTICA: Swiss-Cyber Brutalism
 *   Vantablack #030201 · crema #F0E6D3 · hairline rgba(240,230,211,0.05)
 *   Accenti: VERDE NEON #4AF626 (stato/sistema) · ARANCIO #F4A261 (interazione)
 *   Griglia bento asimmetrica a bordi 1px VISIBILI (tecnica: grid gap 1px su
 *   sfondo hairline → linee matematicamente perfette senza border-collapse).
 *
 * I 5 MODULI SPERIMENTALI
 *   MOD.01  PLASMA      — fluido metaball su canvas 2D low-res upscalato,
 *                          attratto dal puntatore/dito (verde→arancio al contatto)
 *   MOD.02  CINETICA    — tipografia gigante: le lettere fuggono dal cursore
 *                          con ritorno elastico; su mobile reagiscono alla
 *                          VELOCITÀ DI SCROLL (skew/scatter)
 *   MOD.03  TENSIONE    — fisica elastica: nodo SVG agganciato a un cavo,
 *                          insegue il puntatore con molla smorzata e "snappa"
 *                          al rilascio con overshoot
 *   MOD.04  DAEMON      — terminale che esegue una boot-sequence realistica,
 *                          si riavvia ogni volta che rientra nel viewport
 *   MOD.05  TELEMETRIA  — strumentazione live: FPS reali, coordinate puntatore,
 *                          profondità di scroll, uptime
 *
 * ARCHITETTURA PERFORMANCE (le "diavolerie")
 *   1. UN SOLO requestAnimationFrame per l'intera sezione (SharedLoop):
 *      ogni modulo registra una task; l'IntersectionObserver del modulo la
 *      attiva/disattiva. Zero moduli visibili → il rAF si SPEGNE DA SOLO
 *      (non gira nemmeno a vuoto). CPU/GPU a costo zero fuori viewport.
 *   2. visibilitychange → sospensione totale anche a tab nascosta.
 *   3. Canvas plasma: simulazione e rendering su buffer offscreen a 1/7 della
 *      risoluzione, poi upscale con imageSmoothing → effetto fluido "gratis"
 *      (è il blur fisico dell'interpolazione bilineare, non un filtro GPU).
 *   4. Zero useState per le animazioni: solo useRef + scritture DOM dirette
 *      (gsap.quickTo / textContent / setAttribute). React non re-renderizza MAI
 *      durante i 60fps.
 *   5. Touch: tutti i listener { passive: true }, MAI preventDefault,
 *      touch-action: pan-y sui moduli interattivi → Lenis scrolla sempre.
 *   6. Geometrie cacheate (niente getBoundingClientRect nel loop caldo, solo
 *      su resize/entrata) · Float32Array per le particelle · niente allocazioni
 *      di stringhe/oggetti per-frame nei percorsi caldi.
 *   7. prefers-reduced-motion: i loop perpetui si riducono a stati quasi statici.
 *
 * Drop-in: id="lab-section" preservato (il CTA della Hero ci scrolla sopra).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useRef, memo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ── DESIGN TOKENS ─────────────────────────────────────────────────────── */
const C = {
  bg:     '#030201',                    // vantablack (non #000 puro: evita il banding OLED)
  panel:  '#060403',                    // superficie dei moduli
  txt:    '#F0E6D3',                    // crema
  mut:    'rgba(240,230,211,0.34)',
  dim:    'rgba(240,230,211,0.14)',
  hair:   'rgba(240,230,211,0.05)',     // hairline strutturale
  green:  '#4AF626',                    // accento SISTEMA / stato live
  acc:    '#F4A261',                    // accento INTERAZIONE
};
const FONT = "'Outfit', 'Cabinet Grotesk', 'Syne', 'Geist', system-ui, sans-serif";
const MONO = "'JetBrains Mono','Space Mono',ui-monospace,Menlo,monospace";
const DPR  = () => Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 2);

/* ════════════════════════════════════════════════════════════════════════
   SHARED RENDER LOOP — un solo rAF per tutta la sezione.
   - register(id, fn): aggiunge una task (parte disattivata)
   - setActive(id, on): l'IntersectionObserver del modulo la accende/spegne
   - Se NESSUNA task è attiva il loop si auto-cancella (rAF morto, non idle).
   - document.hidden congela tutto a prescindere.
════════════════════════════════════════════════════════════════════════ */
class SharedLoop {
  constructor() {
    this.tasks = new Map();
    this.raf = null;
    this.last = 0;
    this._tick = this._tick.bind(this);
    this._onVis = () => { document.hidden ? this._stop() : this._kick(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._onVis);
  }
  register(id, fn)   { this.tasks.set(id, { fn, on: false }); }
  unregister(id)     { this.tasks.delete(id); if (!this._any()) this._stop(); }
  setActive(id, on)  { const t = this.tasks.get(id); if (!t) return; t.on = on; if (on) this._kick(); }
  _any()             { for (const t of this.tasks.values()) if (t.on) return true; return false; }
  _kick()            { if (this.raf == null && this._any() && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this._tick); } }
  _stop()            { if (this.raf != null) { cancelAnimationFrame(this.raf); this.raf = null; } }
  _tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); // clamp anti-salto (tab resume)
    this.last = now;
    let any = false;
    for (const t of this.tasks.values()) if (t.on) { t.fn(now, dt); any = true; }
    this.raf = any ? requestAnimationFrame(this._tick) : null; // auto-spegnimento
  }
}
const LOOP = new SharedLoop();
let UID = 0;

/* ── helper: prefers-reduced-motion (letto una volta, niente listener) ── */
const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── INTESTAZIONE MODULO (riga mono: indice / titolo / stato) ──────────── */
const ModuleHead = memo(({ index, name, file, live = true }) => (
  <div className="lb-mod-head">
    <span className="lb-mod-index">[ MOD.{index} ]</span>
    <span className="lb-mod-name">{name}</span>
    <span className="lb-mod-file">{file}</span>
    <span className="lb-mod-status">
      <i className={live ? 'lb-dot lb-dot-live' : 'lb-dot'} />
      {live ? 'LIVE' : 'IDLE'}
    </span>
  </div>
));

/* ════════════════════════════════════════════════════════════════════════
   MOD.01 — PLASMA (fluido metaball)
   Simulazione: N blob con fisica a molla verso orbite + attrazione verso il
   puntatore. Rendering: buffer offscreen a bassa risoluzione (1/7), blob come
   gradienti radiali in compositing 'lighter' (i campi si sommano → fusione
   metaball), upscale bilineare = morbidezza fluida senza filtri costosi.
════════════════════════════════════════════════════════════════════════ */
const PlasmaModule = memo(() => {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const ptrRef = useRef({ x: 0.5, y: 0.5, active: false }); // coordinate normalizzate

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current;
    if (!host || !canvas) return;
    const reduced = prefersReduced();

    const SCALE = 7; // il buffer di simulazione è 1/7 del canvas visibile
    const buffer = document.createElement('canvas');
    const bctx = buffer.getContext('2d');
    const ctx = canvas.getContext('2d', { alpha: false });

    const N = 7; // numero di blob
    const bx = new Float32Array(N), by = new Float32Array(N);
    const vx = new Float32Array(N), vy = new Float32Array(N);
    const rad = new Float32Array(N), ph = new Float32Array(N);

    const setup = () => {
      const r = host.getBoundingClientRect();
      const dpr = DPR();
      canvas.width = Math.max(2, (r.width * dpr) | 0);
      canvas.height = Math.max(2, (r.height * dpr) | 0);
      buffer.width = Math.max(2, (canvas.width / SCALE) | 0);
      buffer.height = Math.max(2, (canvas.height / SCALE) | 0);
      ctx.imageSmoothingEnabled = true; // l'upscale bilineare È l'effetto fluido
      for (let i = 0; i < N; i++) {
        bx[i] = Math.random() * buffer.width;
        by[i] = Math.random() * buffer.height;
        vx[i] = 0; vy[i] = 0;
        rad[i] = buffer.width * (0.10 + Math.random() * 0.12);
        ph[i] = Math.random() * Math.PI * 2;
      }
      stateRef.current = { ready: true };
    };
    setup();

    let resizeRaf = null;
    const onResize = () => { if (resizeRaf) cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(setup); };
    window.addEventListener('resize', onResize);

    /* Puntatore: pointermove per il mouse, touch passivo per il dito.
       Coordinate normalizzate 0..1 → indipendenti dalla risoluzione del buffer. */
    const toNorm = (cx, cy) => {
      const r = host.getBoundingClientRect();
      return { x: (cx - r.left) / r.width, y: (cy - r.top) / r.height };
    };
    const onPointerMove = (e) => {
      if (e.pointerType !== 'mouse') return;
      const p = toNorm(e.clientX, e.clientY);
      ptrRef.current.x = p.x; ptrRef.current.y = p.y; ptrRef.current.active = true;
    };
    const onPointerLeave = (e) => { if (e.pointerType === 'mouse') ptrRef.current.active = false; };
    const onTouchMove = (e) => {
      const t = e.touches[0]; if (!t) return;
      const p = toNorm(t.clientX, t.clientY);
      ptrRef.current.x = p.x; ptrRef.current.y = p.y; ptrRef.current.active = true;
    };
    const onTouchEnd = () => { ptrRef.current.active = false; };
    host.addEventListener('pointermove', onPointerMove, { passive: true });
    host.addEventListener('pointerleave', onPointerLeave, { passive: true });
    host.addEventListener('touchstart', onTouchMove, { passive: true });
    host.addEventListener('touchmove', onTouchMove, { passive: true });
    host.addEventListener('touchend', onTouchEnd, { passive: true });
    host.addEventListener('touchcancel', onTouchEnd, { passive: true });

    let time = 0;

    const draw = (now, dt) => {
      if (!stateRef.current?.ready) return;
      time += dt;
      const W = buffer.width, H = buffer.height;
      const ptr = ptrRef.current;
      const px = ptr.x * W, py = ptr.y * H;

      // ── fisica dei blob ──
      for (let i = 0; i < N; i++) {
        // orbita pigra di base (Lissajous individuale)
        const ox = W * (0.5 + 0.34 * Math.sin(time * 0.22 + ph[i] * 2.1));
        const oy = H * (0.5 + 0.30 * Math.cos(time * 0.17 + ph[i] * 1.7));
        let ax = (ox - bx[i]) * 0.55;
        let ay = (oy - by[i]) * 0.55;
        // attrazione verso il puntatore (più forte e nervosa)
        if (ptr.active && !reduced) {
          ax += (px - bx[i]) * 2.4;
          ay += (py - by[i]) * 2.4;
        }
        vx[i] = (vx[i] + ax * dt) * 0.94; // smorzamento → moto viscoso
        vy[i] = (vy[i] + ay * dt) * 0.94;
        bx[i] += vx[i];
        by[i] += vy[i];
      }

      // ── rendering sul buffer low-res ──
      bctx.globalCompositeOperation = 'source-over';
      bctx.fillStyle = C.bg;
      bctx.fillRect(0, 0, W, H);
      bctx.globalCompositeOperation = 'lighter'; // i campi si SOMMANO → metaball

      for (let i = 0; i < N; i++) {
        // vicino al puntatore il blob vira dal verde all'arancio
        let t = 0;
        if (ptr.active) {
          const d = Math.hypot(bx[i] - px, by[i] - py);
          t = Math.max(0, 1 - d / (W * 0.35));
        }
        const r = (74 + (244 - 74) * t) | 0;
        const g = (246 + (162 - 246) * t) | 0;
        const b = (38 + (97 - 38) * t) | 0;
        const R = rad[i] * (1 + 0.12 * Math.sin(time * 1.3 + ph[i]));
        const grd = bctx.createRadialGradient(bx[i], by[i], 0, bx[i], by[i], R);
        grd.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
        grd.addColorStop(0.55, `rgba(${r},${g},${b},0.16)`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        bctx.fillStyle = grd;
        bctx.fillRect(bx[i] - R, by[i] - R, R * 2, R * 2);
      }

      // ── upscale sul canvas visibile (qui nasce la fluidità) ──
      ctx.drawImage(buffer, 0, 0, W, H, 0, 0, canvas.width, canvas.height);

      // ── scanline leggera per il feel CRT (un solo fillRect pattern-free) ──
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = '#000000';
      for (let y = 0; y < canvas.height; y += 4) ctx.fillRect(0, y, canvas.width, 1);
      ctx.globalAlpha = 1;
    };

    const id = `plasma-${UID++}`;
    LOOP.register(id, draw);
    const obs = new IntersectionObserver(([e]) => LOOP.setActive(id, e.isIntersecting), { threshold: 0.05 });
    obs.observe(host);

    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      host.removeEventListener('touchstart', onTouchMove);
      host.removeEventListener('touchmove', onTouchMove);
      host.removeEventListener('touchend', onTouchEnd);
      host.removeEventListener('touchcancel', onTouchEnd);
      obs.disconnect();
      LOOP.unregister(id);
    };
  }, []);

  return (
    <div ref={hostRef} className="lb-mod lb-mod-plasma" data-cursor>
      <ModuleHead index="01" name="PLASMA" file="metaball_field.c2d" />
      <div className="lb-mod-body">
        <canvas ref={canvasRef} className="lb-canvas" aria-hidden="true" />
        <div className="lb-plasma-caption" aria-hidden="true">
          <span className="lb-mono-label">CAMPO SCALARE · 7 NUCLEI · COMPOSITING ADDITIVO</span>
          <span className="lb-mono-label lb-orange">→ TRASCINA PER ATTRARRE LA MASSA</span>
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════════════════
   MOD.02 — CINETICA (tipografia che fugge)
   Desktop: ogni lettera ha tre gsap.quickTo (x/y/rotation). Al pointermove
   le lettere entro il raggio vengono respinte con falloff quadratico; al
   leave tornano con elastic.out. Le geometrie delle lettere sono CACHEATE
   (ricalcolate solo a resize/font-load) → zero getBoundingClientRect nel
   percorso caldo.
   Mobile: niente puntatore — le lettere reagiscono alla VELOCITÀ di scroll
   (skew + scatter proporzionali, decadimento esponenziale) via loop condiviso.
════════════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════════
   MOD.02 — CINETICA (tipografia che fugge)
   v2.1 — FIX DESKTOP: la prima versione usava gsap.quickTo + un tween
   elastico di rientro con overwrite:'auto'. Quel tween UCCIDEVA i tween
   interni dei quickTo → dopo il primo mouseleave le funzioni puntavano a
   tween morti e le lettere smettevano di rispondere. Ora: ZERO tween GSAP
   sulle lettere. Tutta la dinamica è una molla smorzata integrata nel loop
   condiviso (stesso solver del MOD.03):
       v += (target − offset) · k · dt;  v *= damp;  offset += v
   Molla sottosmorzata → il ritorno elastico con overshoot è fisica, non
   easing. Niente conflitti possibili, mai più stati morti.
   Desktop: target = vettore di fuga dal puntatore (falloff quadratico).
   Mobile: target = scatter proporzionale alla velocità di scroll.
   Quando tutte le lettere sono ferme → zero scritture DOM.
════════════════════════════════════════════════════════════════════════ */
const KineticModule = memo(() => {
  const hostRef = useRef(null);
  const wordRef = useRef(null);
  const WORD = 'ENERGIA';

  useEffect(() => {
    const host = hostRef.current, word = wordRef.current;
    if (!host || !word) return;
    const reduced = prefersReduced();
    const letters = Array.from(word.children);
    const N = letters.length;

    // stato fisico per lettera (Float32Array: cache-friendly, zero GC)
    const ox = new Float32Array(N), oy = new Float32Array(N);   // offset corrente
    const vx = new Float32Array(N), vy = new Float32Array(N);   // velocità
    const rot = new Float32Array(N), vr = new Float32Array(N);  // rotazione + velocità angolare

    // cache dei centri lettera RELATIVI al modulo (ricalcolo solo su resize/font)
    let centers = [];
    const measure = () => {
      const hr = host.getBoundingClientRect();
      centers = letters.map(el => {
        const r = el.getBoundingClientRect();
        // sottraggo l'offset corrente: voglio il centro "a riposo", non quello deformato
        const i = letters.indexOf(el);
        return { x: r.left - hr.left + r.width / 2 - ox[i], y: r.top - hr.top + r.height / 2 - oy[i] };
      });
    };
    measure();
    if (document.fonts?.ready) document.fonts.ready.then(measure); // il webfont cambia le metriche
    let resizeRaf = null;
    const onResize = () => { if (resizeRaf) cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(measure); };
    window.addEventListener('resize', onResize);

    /* ── input: il puntatore scrive solo in questo oggetto, la fisica lo legge ── */
    const ptr = { x: 0, y: 0, active: false };
    const onPointerMove = (e) => {
      if (e.pointerType !== 'mouse' || reduced) return;
      const hr = host.getBoundingClientRect(); // 1 rect per evento (≤60hz, ok)
      ptr.x = e.clientX - hr.left;
      ptr.y = e.clientY - hr.top;
      ptr.active = true;
    };
    const onPointerLeave = (e) => { if (e.pointerType === 'mouse') ptr.active = false; };
    host.addEventListener('pointermove', onPointerMove, { passive: true });
    host.addEventListener('pointerleave', onPointerLeave, { passive: true });

    /* ── mobile: velocità di scroll → scatter ── */
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    let lastY = window.scrollY;
    let scrollVel = 0;

    /* ── parametri della molla ──
       K alto + damp < 0.9 = sottosmorzata → overshoot elastico al rientro */
    const RADIUS = 280;  // raggio di repulsione (px)
    const K = 70;        // rigidità
    const DAMP = 0.86;   // smorzamento

    const task = (now, dt) => {
      if (reduced) return;

      // velocità di scroll (solo touch)
      let sv = 0;
      if (isCoarse) {
        const y = window.scrollY;
        const raw = (y - lastY) / Math.max(dt, 0.001); // px/s
        lastY = y;
        scrollVel += (raw - scrollVel) * Math.min(1, dt * 10);
        sv = Math.max(-1, Math.min(1, scrollVel / 2200));
      }
      const sa = Math.abs(sv);

      for (let i = 0; i < N; i++) {
        // 1) calcolo del TARGET (dove la molla vuole portare la lettera)
        let tx = 0, ty = 0, tr = 0;
        if (ptr.active) {
          const dx = centers[i].x - ptr.x, dy = centers[i].y - ptr.y;
          const d = Math.hypot(dx, dy);
          if (d < RADIUS) {
            const f = 1 - d / RADIUS, ff = f * f; // falloff quadratico
            const inv = 1 / (d || 1);
            tx = dx * inv * ff * 96;
            ty = dy * inv * ff * 74;
            tr = dx * inv * ff * 15;
          }
        }
        if (isCoarse && sa > 0.02) {
          const dir = i % 2 ? 1 : -1; // lettere alternate su/giù → scatter
          ty += dir * sa * 38 * (0.5 + (i % 3) * 0.35);
          tr += sv * dir * 9;
        }

        // 2) integrazione della molla smorzata
        vx[i] = (vx[i] + (tx - ox[i]) * K * dt) * DAMP;
        vy[i] = (vy[i] + (ty - oy[i]) * K * dt) * DAMP;
        vr[i] = (vr[i] + (tr - rot[i]) * K * dt) * DAMP;
        ox[i] += vx[i]; oy[i] += vy[i]; rot[i] += vr[i];

        // 3) scrittura DOM solo se la lettera si sta muovendo davvero
        const still =
          Math.abs(ox[i]) < 0.03 && Math.abs(oy[i]) < 0.03 && Math.abs(rot[i]) < 0.03 &&
          Math.abs(vx[i]) < 0.03 && Math.abs(vy[i]) < 0.03 && Math.abs(vr[i]) < 0.03;
        if (!still) {
          letters[i].style.transform =
            `translate3d(${ox[i].toFixed(2)}px,${oy[i].toFixed(2)}px,0) rotate(${rot[i].toFixed(2)}deg)`;
        } else if (letters[i].style.transform !== '') {
          // assestamento definitivo: un'unica scrittura di reset, poi silenzio
          letters[i].style.transform = '';
          ox[i] = 0; oy[i] = 0; rot[i] = 0; vx[i] = 0; vy[i] = 0; vr[i] = 0;
        }
      }
    };

    const id = `kinetic-${UID++}`;
    LOOP.register(id, task);
    const obs = new IntersectionObserver(([e]) => LOOP.setActive(id, e.isIntersecting), { threshold: 0.05 });
    obs.observe(host);

    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      obs.disconnect();
      LOOP.unregister(id);
      letters.forEach(el => { el.style.transform = ''; });
    };
  }, []);

  return (
    <div ref={hostRef} className="lb-mod lb-mod-kinetic" data-cursor>
      <ModuleHead index="02" name="CINETICA" file="type_repulsion.gsap" />
      <div className="lb-mod-body lb-kinetic-body">
        <div ref={wordRef} className="lb-kinetic-word" aria-label={WORD}>
          {WORD.split('').map((ch, i) => (
            <span key={i} className="lb-kinetic-letter" aria-hidden="true">{ch}</span>
          ))}
        </div>
        <div className="lb-kinetic-caption" aria-hidden="true">
          <span className="lb-mono-label">MASSA TIPOGRAFICA · MOLLA SOTTOSMORZATA</span>
          <span className="lb-mono-label lb-orange lb-only-fine">→ ATTRAVERSA LE LETTERE</span>
          <span className="lb-mono-label lb-orange lb-only-coarse">→ SCROLLA VELOCE PER DEFORMARE</span>
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════════════════
   MOD.03 — TENSIONE (fisica elastica SVG)
   Integratore a molla smorzata nel loop condiviso:
     acc = (target − pos) · k        →  vel += acc·dt; vel *= damping
   Quando il puntatore è attivo il target è il puntatore (molla morbida);
   al rilascio il target torna all'ancora con molla più rigida → overshoot
   elastico naturale, NESSUN tween: è fisica vera.
   Il cavo è un path quadratico il cui punto di controllo "sagga" in base
   alla distanza (simula il peso del cavo).
════════════════════════════════════════════════════════════════════════ */
const TensionModule = memo(() => {
  const hostRef = useRef(null);
  const svgRef = useRef(null);
  const cordRef = useRef(null);
  const nodeRef = useRef(null);
  const ringRef = useRef(null);
  const readoutRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current, svg = svgRef.current;
    const cord = cordRef.current, node = nodeRef.current, ring = ringRef.current;
    if (!host || !svg || !cord || !node || !ring) return;
    const reduced = prefersReduced();

    // dimensioni logiche del viewBox (coordinate stabili, indipendenti dal CSS)
    const VW = 1000, VH = 600;
    const anchor = { x: 180, y: VH / 2 };          // punto di aggancio del cavo
    const rest   = { x: VW * 0.62, y: VH / 2 };    // posizione di riposo del nodo
    const pos = { x: rest.x, y: rest.y };
    const velo = { x: 0, y: 0 };
    const target = { x: rest.x, y: rest.y, grab: false };

    // conversione client→viewBox (cache del rect, refresh su resize)
    let rect = host.getBoundingClientRect();
    let resizeRaf = null;
    const onResize = () => { if (resizeRaf) cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(() => { rect = host.getBoundingClientRect(); }); };
    window.addEventListener('resize', onResize);

    const toVB = (cx, cy) => ({
      x: ((cx - rect.left) / rect.width) * VW,
      y: ((cy - rect.top) / rect.height) * VH,
    });

    const onPointerMove = (e) => {
      if (e.pointerType !== 'mouse' || reduced) return;
      rect = host.getBoundingClientRect(); // il modulo può essere scrollato: rect fresco a evento, non a frame
      const p = toVB(e.clientX, e.clientY);
      target.x = p.x; target.y = p.y; target.grab = true;
    };
    const onPointerLeave = (e) => { if (e.pointerType === 'mouse') { target.grab = false; } };
    const onTouchMove = (e) => {
      if (reduced) return;
      const t = e.touches[0]; if (!t) return;
      rect = host.getBoundingClientRect();
      const p = toVB(t.clientX, t.clientY);
      target.x = p.x; target.y = p.y; target.grab = true;
    };
    const onTouchEnd = () => { target.grab = false; };
    host.addEventListener('pointermove', onPointerMove, { passive: true });
    host.addEventListener('pointerleave', onPointerLeave, { passive: true });
    host.addEventListener('touchstart', onTouchMove, { passive: true });
    host.addEventListener('touchmove', onTouchMove, { passive: true });
    host.addEventListener('touchend', onTouchEnd, { passive: true });
    host.addEventListener('touchcancel', onTouchEnd, { passive: true });

    const readout = readoutRef.current;
    let lastReadout = 0;

    const draw = (now, dt) => {
      // molla: morbida quando insegue il dito, rigida quando snappa a riposo
      const tx = target.grab ? target.x : rest.x;
      const ty = target.grab ? target.y : rest.y;
      const k = target.grab ? 42 : 90;        // rigidità
      const damp = target.grab ? 0.88 : 0.84; // smorzamento (più basso = più oscillazioni)

      velo.x = (velo.x + (tx - pos.x) * k * dt) * damp;
      velo.y = (velo.y + (ty - pos.y) * k * dt) * damp;
      pos.x += velo.x;
      pos.y += velo.y;

      // cavo: quadratica con controllo che sagga proporzionalmente alla distanza
      const dist = Math.hypot(pos.x - anchor.x, pos.y - anchor.y);
      const sag = Math.max(0, 140 - dist * 0.18);
      const cxp = (anchor.x + pos.x) / 2;
      const cyp = (anchor.y + pos.y) / 2 + sag;
      cord.setAttribute('d', `M ${anchor.x} ${anchor.y} Q ${cxp} ${cyp} ${pos.x} ${pos.y}`);

      // tensione del cavo → colore (verde rilassato → arancio in trazione)
      const tension = Math.min(1, dist / 620);
      cord.setAttribute('stroke', tension > 0.55 ? C.acc : C.green);
      cord.setAttribute('stroke-width', String(1.5 + tension * 2.5));

      node.setAttribute('cx', pos.x); node.setAttribute('cy', pos.y);
      ring.setAttribute('cx', pos.x); ring.setAttribute('cy', pos.y);
      const speed = Math.hypot(velo.x, velo.y);
      ring.setAttribute('r', String(26 + Math.min(34, speed * 1.4)));
      ring.setAttribute('stroke-opacity', String(Math.min(0.9, 0.25 + speed * 0.03)));

      // readout mono throttlato (testo ogni ~120ms: il DOM text è "caro")
      if (readout && now - lastReadout > 120) {
        lastReadout = now;
        readout.textContent = `TENSIONE ${(tension * 100).toFixed(0).padStart(3, '0')}% · V ${(speed * 10).toFixed(0).padStart(4, '0')} · ${target.grab ? 'AGGANCIATO' : 'RILASCIATO'}`;
      }
    };

    const id = `tension-${UID++}`;
    LOOP.register(id, draw);
    const obs = new IntersectionObserver(([e]) => LOOP.setActive(id, e.isIntersecting), { threshold: 0.05 });
    obs.observe(host);

    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      host.removeEventListener('touchstart', onTouchMove);
      host.removeEventListener('touchmove', onTouchMove);
      host.removeEventListener('touchend', onTouchEnd);
      host.removeEventListener('touchcancel', onTouchEnd);
      obs.disconnect();
      LOOP.unregister(id);
    };
  }, []);

  return (
    <div ref={hostRef} className="lb-mod lb-mod-tension" data-cursor>
      <ModuleHead index="03" name="TENSIONE" file="spring_solver.svg" />
      <div className="lb-mod-body">
        <svg ref={svgRef} className="lb-tension-svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {/* griglia tecnica di fondo */}
          <g stroke={C.hair} strokeWidth="1">
            <line x1="0" y1="300" x2="1000" y2="300" />
            <line x1="500" y1="0" x2="500" y2="600" />
          </g>
          {/* ancora */}
          <circle cx="180" cy="300" r="7" fill="none" stroke={C.mut} strokeWidth="1.5" />
          <circle cx="180" cy="300" r="2.5" fill={C.txt} />
          {/* cavo */}
          <path ref={cordRef} d="M 180 300 Q 400 360 620 300" fill="none" stroke={C.green} strokeWidth="1.5" />
          {/* anello di velocità + nodo */}
          <circle ref={ringRef} cx="620" cy="300" r="26" fill="none" stroke={C.acc} strokeWidth="1" strokeOpacity="0.3" />
          <circle ref={nodeRef} cx="620" cy="300" r="13" fill={C.txt} />
        </svg>
        <div className="lb-tension-caption" aria-hidden="true">
          <span ref={readoutRef} className="lb-mono-label lb-green">TENSIONE 000% · V 0000 · RILASCIATO</span>
          <span className="lb-mono-label lb-orange">→ TIRA IL NODO E LASCIALO ANDARE</span>
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════════════════
   MOD.04 — DAEMON (boot di sistema)
   Macchina a stati di typing nel loop condiviso (accumulatore di caratteri
   in base al dt → la velocità non dipende dal framerate). Ad ogni RIENTRO
   nel viewport il daemon si RI-BOOTA con valori freschi (PID, latenze, hash)
   → la scena non è mai identica due volte. Le righe completate diventano
   nodi DOM statici; solo la riga corrente viene riscritta.
════════════════════════════════════════════════════════════════════════ */
const DaemonModule = memo(() => {
  const hostRef = useRef(null);
  const screenRef = useRef(null);
  const stateRef = useRef({ lines: [], li: 0, ci: 0, acc: 0, waiting: 0, done: false });

  // generatore di boot-script (valori random ad ogni boot)
  const makeScript = () => {
    const pid = 1000 + ((Math.random() * 9000) | 0);
    const ms = () => (2 + Math.random() * 46).toFixed(1);
    const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[(Math.random() * 16) | 0]).join('');
    return [
      { t: `$ sudo systemctl start seba-lab.daemon`, c: 'txt', d: 300 },
      { t: `[BOOT] kernel 6.9.1-creative ............ OK`, c: 'ok', d: 60 },
      { t: `[BOOT] allocazione vram canvas .......... OK`, c: 'ok', d: 50 },
      { t: `[BOOT] mount /dev/typography ............. OK`, c: 'ok', d: 50 },
      { t: `[SYS ] pid ${pid} · heap 47.2MB · dpr ${typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2).toFixed(1) : '2.0'}`, c: 'mut', d: 120 },
      { t: `[NET ] handshake portfolio.api ........... ${ms()}ms`, c: 'ok', d: 90 },
      { t: `[NET ] handshake gsap.core ............... ${ms()}ms`, c: 'ok', d: 70 },
      { t: `[WARN] ego.module non trovato — skip`, c: 'warn', d: 260 },
      { t: `[GPU ] compositing additivo .............. ATTIVO`, c: 'ok', d: 80 },
      { t: `[FIS ] spring-solver k=42 damp=0.88 ...... STABILE`, c: 'ok', d: 80 },
      { t: `[SEC ] checksum ${hex(12)} .... VALIDO`, c: 'mut', d: 140 },
      { t: `[LAB ] 5 moduli sperimentali ............. ONLINE`, c: 'ok', d: 110 },
      { t: ``, c: 'mut', d: 200 },
      { t: `> sistema operativo. nessun errore critico.`, c: 'accent', d: 320 },
      { t: `> in ascolto su :45.0703N,7.6869E_torino`, c: 'accent', d: 0 },
    ];
  };

  useEffect(() => {
    const host = hostRef.current, screen = screenRef.current;
    if (!host || !screen) return;
    const reduced = prefersReduced();
    const st = stateRef.current;

    const colorOf = (c) =>
      c === 'ok' ? C.green : c === 'warn' ? C.acc : c === 'accent' ? C.acc : c === 'mut' ? C.mut : C.txt;

    // riga "viva" (typing) + caret — riusati, mai ricreati
    const liveLine = document.createElement('div');
    liveLine.className = 'lb-term-line';
    const liveText = document.createElement('span');
    const caret = document.createElement('span');
    caret.className = 'lb-term-caret';
    liveLine.appendChild(liveText);
    liveLine.appendChild(caret);

    const boot = () => {
      st.lines = makeScript();
      st.li = 0; st.ci = 0; st.acc = 0; st.waiting = 0; st.done = false;
      screen.textContent = '';
      screen.appendChild(liveLine);
      liveText.textContent = '';
      liveText.style.color = colorOf(st.lines[0].c);
      if (reduced) {
        // reduced motion: dump immediato, niente typing
        screen.textContent = '';
        st.lines.forEach(l => {
          const div = document.createElement('div');
          div.className = 'lb-term-line';
          div.textContent = l.t;
          div.style.color = colorOf(l.c);
          screen.appendChild(div);
        });
        st.done = true;
      }
    };

    const commitLine = (l) => {
      const div = document.createElement('div');
      div.className = 'lb-term-line';
      div.textContent = l.t;
      div.style.color = colorOf(l.c);
      screen.insertBefore(div, liveLine);
      screen.scrollTop = screen.scrollHeight; // auto-scroll in fondo
    };

    const CPS = 110; // caratteri al secondo

    const draw = (now, dt) => {
      if (st.done) return;
      // pausa post-riga (drammaturgia del boot)
      if (st.waiting > 0) { st.waiting -= dt * 1000; return; }
      const line = st.lines[st.li];
      if (!line) { st.done = true; caret.style.display = 'inline-block'; return; }

      st.acc += dt * CPS;
      let typed = false;
      while (st.acc >= 1 && st.ci < line.t.length) {
        st.acc -= 1; st.ci += 1; typed = true;
      }
      if (typed) {
        liveText.textContent = line.t.slice(0, st.ci);
        liveText.style.color = colorOf(line.c);
        screen.scrollTop = screen.scrollHeight;
      }
      if (st.ci >= line.t.length) {
        commitLine(line);
        liveText.textContent = '';
        st.li += 1; st.ci = 0;
        st.waiting = line.d; // delay dichiarato dalla riga
      }
    };

    const id = `daemon-${UID++}`;
    LOOP.register(id, draw);
    const obs = new IntersectionObserver(([e]) => {
      LOOP.setActive(id, e.isIntersecting);
      if (e.isIntersecting) boot(); // RI-BOOT ad ogni rientro nel viewport
    }, { threshold: 0.15 });
    obs.observe(host);

    return () => { obs.disconnect(); LOOP.unregister(id); };
  }, []);

  return (
    <div ref={hostRef} className="lb-mod lb-mod-daemon">
      <ModuleHead index="04" name="DAEMON" file="boot_sequence.sh" />
      <div className="lb-mod-body">
        <div ref={screenRef} className="lb-term-screen" aria-label="Log di sistema simulato" />
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════════════════
   MOD.05 — TELEMETRIA (strumentazione live)
   FPS reali (media mobile esponenziale del dt), coordinate puntatore,
   profondità di scroll, uptime. Le scritture DOM sono throttlate a ~8Hz:
   leggere i numeri a 60Hz è impossibile per l'occhio e costoso per il DOM.
════════════════════════════════════════════════════════════════════════ */
const TelemetryModule = memo(() => {
  const hostRef = useRef(null);
  const fpsRef = useRef(null);
  const ptrRef = useRef(null);
  const scrRef = useRef(null);
  const upRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const ptr = { x: 0, y: 0 };
    const onPointer = (e) => { ptr.x = e.clientX | 0; ptr.y = e.clientY | 0; };
    window.addEventListener('pointermove', onPointer, { passive: true });

    let ema = 16.7;           // dt smussato (ms)
    let last = 0;             // ultimo aggiornamento del DOM
    const t0 = performance.now();

    const draw = (now, dt) => {
      ema += (dt * 1000 - ema) * 0.08;
      if (now - last < 125) return; // throttle scritture DOM a 8Hz
      last = now;

      const fps = Math.min(120, Math.round(1000 / Math.max(1, ema)));
      if (fpsRef.current) {
        fpsRef.current.textContent = String(fps).padStart(3, '0');
        fpsRef.current.style.color = fps >= 50 ? C.green : C.acc; // sotto i 50 → allerta arancio
      }
      if (ptrRef.current) ptrRef.current.textContent = `${String(ptr.x).padStart(4, '0')},${String(ptr.y).padStart(4, '0')}`;
      if (scrRef.current) {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        scrRef.current.textContent = `${Math.round((window.scrollY / max) * 100)}%`.padStart(4, ' ');
      }
      if (upRef.current) {
        const s = ((now - t0) / 1000) | 0;
        upRef.current.textContent = `${String((s / 60) | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      }
    };

    const id = `telemetry-${UID++}`;
    LOOP.register(id, draw);
    const obs = new IntersectionObserver(([e]) => LOOP.setActive(id, e.isIntersecting), { threshold: 0.05 });
    obs.observe(host);

    return () => {
      window.removeEventListener('pointermove', onPointer);
      obs.disconnect();
      LOOP.unregister(id);
    };
  }, []);

  const Cell = ({ label, refEl, suffix }) => (
    <div className="lb-tel-cell">
      <span className="lb-mono-label">{label}</span>
      <span className="lb-tel-value"><span ref={refEl}>—</span>{suffix ? <em>{suffix}</em> : null}</span>
    </div>
  );

  return (
    <div ref={hostRef} className="lb-mod lb-mod-telemetry">
      <ModuleHead index="05" name="TELEMETRIA" file="vitals.live" />
      <div className="lb-mod-body lb-tel-grid">
        <Cell label="FRAMERATE" refEl={fpsRef} suffix="FPS" />
        <Cell label="PUNTATORE" refEl={ptrRef} />
        <Cell label="PROFONDITÀ" refEl={scrRef} />
        <Cell label="UPTIME" refEl={upRef} />
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════════════════
   SEZIONE PRINCIPALE
════════════════════════════════════════════════════════════════════════ */
export default function LabSection() {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);

  /* Entrata coreografata: GSAP + ScrollTrigger once.
     - useLayoutEffect: lo stato nascosto viene applicato PRIMA del paint
       → zero flash del contenuto non animato (FOUC)
     - gsap.set + .to() (mai fromTo con immediateRender: è il pattern che
       causava il black-screen bug)
     - si animano le .lb-title-line INTERNE, mai le righe-maschera
       (overflow:hidden): la maschera resta ferma, il testo scivola dentro
     - trigger sul ref della SEZIONE (ancora stabile, mai trasformata) */
  React.useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const reduced = prefersReduced();
      const lines = titleRef.current.querySelectorAll('.lb-title-line');
      const mods = gsap.utils.toArray('.lb-mod');

      if (reduced) return; // reduced motion: tutto visibile subito, zero reveal

      gsap.set(lines, { yPercent: 110 });
      gsap.set(mods, { autoAlpha: 0, y: 36 });

      gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 72%', once: true },
      })
        .to(lines, { yPercent: 0, duration: 1.0, ease: 'power4.out', stagger: 0.09 })
        .to(mods, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12 }, '-=0.55');
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  /* Marquee: animazione CSS pura (compositor-only) ma con play-state gated
     dall'observer → anche il costo compositing è zero fuori viewport. */
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const obs = new IntersectionObserver(
      ([e]) => section.classList.toggle('lb-live', e.isIntersecting),
      { threshold: 0.02 }
    );
    obs.observe(section);
    return () => obs.disconnect();
  }, []);

  const marqueeText = 'ESPERIMENTI INTERATTIVI /// MOTION /// FISICA /// TIPOGRAFIA /// SISTEMI /// ';

  return (
    <section ref={sectionRef} id="lab-section" className="lb-section">
      {/* rail verticali strutturali */}
      <div aria-hidden="true" className="lb-rails">
        <span className="lb-rail lb-rail-l" />
        <span className="lb-rail lb-rail-r" />
      </div>

      {/* ── HEADER MONUMENTALE ── */}
      <header className="lb-header">
        <div className="lb-header-meta">
          <span className="lb-mono-label">[ 02 / LABORATORIO ]</span>
          <span className="lb-mono-label">45.0703° N — 07.6869° E</span>
          <span className="lb-mono-label lb-green">● SISTEMI ONLINE</span>
        </div>
        <h2 ref={titleRef} className="lb-title" aria-label="Il laboratorio">
          <span className="lb-title-row"><span className="lb-title-line">IL LABO—</span></span>
          <span className="lb-title-row lb-title-row-2"><span className="lb-title-line">RATORIO<i className="lb-title-dot">.</i></span></span>
        </h2>
        <p className="lb-header-sub">
          Cinque esperimenti vivi. Fisica, fluidi e tipografia che rispondono al tocco —
          ogni modulo si congela quando esce dallo schermo. Zero sprechi, solo materia.
        </p>
      </header>

      {/* ── MARQUEE ── */}
      <div className="lb-marquee" aria-hidden="true">
        <div className="lb-marquee-track">
          <span>{marqueeText}</span>
          <span>{marqueeText}</span>
        </div>
      </div>

      {/* ── GRIGLIA BENTO (gap 1px su sfondo hairline = bordi perfetti) ── */}
      <div className="lb-grid">
        <PlasmaModule />
        <KineticModule />
        <TensionModule />
        <DaemonModule />
        <TelemetryModule />
      </div>

      {/* ── FOOTER STRIP ── */}
      <div className="lb-footstrip" aria-hidden="true">
        <span className="lb-mono-label">FINE TRASMISSIONE</span>
        <span className="lb-mono-label">REV 2.0 / {new Date().getFullYear()}</span>
      </div>

      <style>{`
        /* ═══ STRUTTURA ═══ */
        .lb-section {
          position: relative;
          background: ${C.bg};
          color: ${C.txt};
          font-family: ${FONT};
          padding: clamp(5rem, 12vh, 11rem) 0 clamp(3rem, 6vh, 6rem);
          overflow: hidden;
        }
        .lb-rails { position: absolute; inset: 0; pointer-events: none; }
        .lb-rail { position: absolute; top: 0; bottom: 0; width: 1px; background: ${C.hair}; }
        .lb-rail-l { left: clamp(1.25rem, 4vw, 4.5rem); }
        .lb-rail-r { right: clamp(1.25rem, 4vw, 4.5rem); }

        /* ═══ TIPOGRAFIA DI SERVIZIO ═══ */
        .lb-mono-label {
          font-family: ${MONO};
          font-size: clamp(0.56rem, 0.75vw, 0.68rem);
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${C.mut};
          white-space: nowrap;
        }
        .lb-green  { color: ${C.green} !important; }
        .lb-orange { color: ${C.acc} !important; }

        /* ═══ HEADER ═══ */
        .lb-header { position: relative; z-index: 2; padding: 0 clamp(2rem, 6vw, 6.5rem); }
        .lb-header-meta {
          display: flex; flex-wrap: wrap; gap: clamp(1rem, 3vw, 2.6rem);
          padding-bottom: clamp(1.2rem, 2.4vh, 2rem);
          border-bottom: 1px solid ${C.hair};
          margin-bottom: clamp(1.6rem, 3.5vh, 3rem);
        }
        .lb-title {
          margin: 0; padding: 0;
          font-weight: 900; text-transform: uppercase;
          font-size: clamp(3.4rem, 12.5vw, 14rem);
          line-height: 0.86; letter-spacing: -0.045em;
          color: ${C.txt}; user-select: none;
        }
        .lb-title-row { display: block; overflow: hidden; padding-bottom: 0.06em; }
        .lb-title-row-2 { padding-left: clamp(1.5rem, 11vw, 12rem); }
        .lb-title-line { display: inline-block; will-change: transform; }
        .lb-title-dot { font-style: normal; color: ${C.green}; }
        .lb-header-sub {
          margin: clamp(1.4rem, 3vh, 2.6rem) 0 0;
          max-width: 44ch;
          font-size: clamp(0.92rem, 1.15vw, 1.08rem);
          line-height: 1.7; color: ${C.mut};
        }

        /* ═══ MARQUEE ═══ */
        .lb-marquee {
          margin: clamp(2.5rem, 6vh, 5rem) 0 0;
          border-top: 1px solid ${C.hair}; border-bottom: 1px solid ${C.hair};
          overflow: hidden; white-space: nowrap;
        }
        .lb-marquee-track {
          display: inline-flex;
          animation: lb-marq 26s linear infinite;
          animation-play-state: paused;
          will-change: transform;
        }
        .lb-live .lb-marquee-track { animation-play-state: running; }
        .lb-marquee-track span {
          font-family: ${MONO};
          font-size: clamp(0.62rem, 0.85vw, 0.78rem);
          letter-spacing: 0.22em; color: ${C.dim};
          padding: 0.85em 0; text-transform: uppercase;
        }
        @keyframes lb-marq { to { transform: translateX(-50%); } }

        /* ═══ GRIGLIA BENTO — il trucco del gap 1px ═══
           gap:1px + background hairline sul contenitore = linee divisorie
           matematicamente perfette, zero border doubling. */
        .lb-grid {
          position: relative; z-index: 2;
          margin: 0 clamp(1.25rem, 4vw, 4.5rem);
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 1px;
          background: ${C.hair};
          border: 1px solid ${C.hair};
        }
        .lb-mod { background: ${C.panel}; min-width: 0; display: flex; flex-direction: column; }
        .lb-mod-plasma    { grid-column: span 12; min-height: clamp(380px, 62vh, 720px); }
        .lb-mod-kinetic   { grid-column: span 7;  min-height: clamp(340px, 50vh, 600px); }
        .lb-mod-tension   { grid-column: span 5;  min-height: clamp(340px, 50vh, 600px); touch-action: pan-y; }
        .lb-mod-daemon    { grid-column: span 8;  min-height: clamp(320px, 44vh, 540px); }
        .lb-mod-telemetry { grid-column: span 4;  min-height: clamp(320px, 44vh, 540px); }
        .lb-mod-plasma, .lb-mod-kinetic { touch-action: pan-y; } /* il dito interagisce MA lo scroll passa */

        /* ═══ INTESTAZIONE MODULO ═══ */
        .lb-mod-head {
          display: flex; align-items: center; gap: clamp(0.7rem, 1.6vw, 1.4rem);
          padding: clamp(0.7rem, 1.4vh, 1rem) clamp(0.9rem, 2vw, 1.6rem);
          border-bottom: 1px solid ${C.hair};
          font-family: ${MONO}; font-size: clamp(0.56rem, 0.72vw, 0.66rem);
          letter-spacing: 0.14em; text-transform: uppercase;
          flex-shrink: 0;
        }
        .lb-mod-index { color: ${C.acc}; }
        .lb-mod-name  { color: ${C.txt}; font-weight: 600; }
        .lb-mod-file  { color: ${C.dim}; overflow: hidden; text-overflow: ellipsis; }
        .lb-mod-status { margin-left: auto; color: ${C.mut}; display: inline-flex; align-items: center; gap: 0.5em; }
        .lb-dot { width: 6px; height: 6px; border-radius: 50%; background: ${C.dim}; display: inline-block; }
        .lb-dot-live { background: ${C.green}; box-shadow: 0 0 8px ${C.green}66; animation: lb-pulse 2.4s ease-in-out infinite; }
        @keyframes lb-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }

        .lb-mod-body { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
        .lb-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; display: block; }

        /* ═══ MOD.01 PLASMA ═══ */
        .lb-plasma-caption {
          position: absolute; left: 0; right: 0; bottom: 0;
          display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
          padding: clamp(0.7rem, 1.5vh, 1.1rem) clamp(0.9rem, 2vw, 1.6rem);
          border-top: 1px solid ${C.hair};
          background: rgba(3,2,1,0.55); backdrop-filter: none;
          pointer-events: none;
        }

        /* ═══ MOD.02 CINETICA ═══ */
        .lb-kinetic-body { align-items: center; justify-content: center; padding: clamp(1.5rem, 4vh, 3rem) clamp(1rem, 2.5vw, 2rem); }
        .lb-kinetic-word {
          display: flex;
          font-weight: 900; text-transform: uppercase;
          font-size: clamp(2.6rem, 9.2vw, 9rem);
          letter-spacing: -0.03em; line-height: 1;
          color: ${C.txt}; user-select: none;
        }
        .lb-kinetic-letter { display: inline-block; will-change: transform; }
        .lb-kinetic-letter:nth-child(4) { color: ${C.green}; }   /* la R verde: firma cromatica */
        .lb-kinetic-caption {
          position: absolute; left: 0; right: 0; bottom: 0;
          display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
          padding: clamp(0.7rem, 1.5vh, 1.1rem) clamp(0.9rem, 2vw, 1.6rem);
          border-top: 1px solid ${C.hair}; pointer-events: none;
        }
        /* le istruzioni cambiano in base al tipo di puntatore del device */
        .lb-only-coarse { display: none; }
        @media (hover: none), (pointer: coarse) {
          .lb-only-fine { display: none; }
          .lb-only-coarse { display: inline; }
        }

        /* ═══ MOD.03 TENSIONE ═══ */
        .lb-tension-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
        .lb-tension-caption {
          position: absolute; left: 0; right: 0; bottom: 0;
          display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
          padding: clamp(0.7rem, 1.5vh, 1.1rem) clamp(0.9rem, 2vw, 1.6rem);
          border-top: 1px solid ${C.hair}; pointer-events: none;
        }

        /* ═══ MOD.04 DAEMON ═══ */
        .lb-term-screen {
          flex: 1; min-height: 0;
          overflow: hidden;
          padding: clamp(1rem, 2.2vh, 1.6rem) clamp(1rem, 2.2vw, 1.8rem);
          font-family: ${MONO};
          font-size: clamp(0.62rem, 0.95vw, 0.8rem);
          line-height: 1.85;
          letter-spacing: 0.02em;
        }
        .lb-term-line { white-space: pre-wrap; word-break: break-all; min-height: 1.85em; }
        .lb-term-caret {
          display: inline-block; width: 0.55em; height: 1.05em;
          background: ${C.green}; vertical-align: text-bottom; margin-left: 2px;
          animation: lb-caret 1s steps(1) infinite;
        }
        @keyframes lb-caret { 50% { opacity: 0; } }

        /* ═══ MOD.05 TELEMETRIA ═══ */
        .lb-tel-grid {
          display: grid; grid-template-columns: 1fr; gap: 1px;
          background: ${C.hair};
        }
        .lb-tel-cell {
          background: ${C.panel};
          padding: clamp(0.9rem, 2vh, 1.4rem) clamp(1rem, 2.2vw, 1.8rem);
          display: flex; flex-direction: column; gap: 0.45rem; justify-content: center;
        }
        .lb-tel-value {
          font-family: ${MONO}; font-weight: 600;
          font-size: clamp(1.5rem, 3.2vw, 2.6rem);
          color: ${C.txt}; line-height: 1; font-variant-numeric: tabular-nums;
        }
        .lb-tel-value em { font-style: normal; font-size: 0.42em; color: ${C.mut}; margin-left: 0.5em; letter-spacing: 0.12em; }

        /* ═══ FOOTER STRIP ═══ */
        .lb-footstrip {
          display: flex; justify-content: space-between; gap: 1rem;
          margin: 0 clamp(1.25rem, 4vw, 4.5rem);
          padding: clamp(1rem, 2.2vh, 1.6rem) 0 0;
        }

        /* ═══ RESPONSIVE — impilamento elegante ═══ */
        @media (max-width: 980px) {
          .lb-mod-kinetic   { grid-column: span 12; }
          .lb-mod-tension   { grid-column: span 12; }
          .lb-mod-daemon    { grid-column: span 12; }
          .lb-mod-telemetry { grid-column: span 12; }
          .lb-tel-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 640px) {
          .lb-title { font-size: clamp(3rem, 16.5vw, 5.4rem); }
          .lb-title-row-2 { padding-left: clamp(0.8rem, 8vw, 2.5rem); }
          .lb-mod-plasma  { min-height: clamp(300px, 52vh, 480px); }
          .lb-mod-kinetic { min-height: clamp(260px, 40vh, 420px); }
          .lb-mod-tension { min-height: clamp(280px, 42vh, 440px); }
          .lb-mod-daemon  { min-height: clamp(280px, 40vh, 420px); }
          .lb-mod-file { display: none; } /* il nome-file mono è rumore sotto i 640px */
          .lb-kinetic-word { font-size: clamp(2.2rem, 12.5vw, 4.2rem); }
        }
        @media (max-width: 400px) {
          .lb-header-meta { gap: 0.7rem; }
          .lb-tel-grid { grid-template-columns: 1fr; }
        }

        /* ═══ REDUCED MOTION ═══ */
        @media (prefers-reduced-motion: reduce) {
          .lb-marquee-track { animation: none; }
          .lb-dot-live { animation: none; }
          .lb-term-caret { animation: none; }
        }
      `}</style>
    </section>
  );
}