import { useEffect, useRef, useState, useCallback, memo } from 'react';
import gsap from 'gsap';

/* ════════════════════════════════════════════════════════════════════
   PRELOADER — "MONOLITH / NEURAL UPLINK"
   ────────────────────────────────────────────────────────────────────
   Concept  : il risveglio di un'infrastruttura Python (Uvicorn/FastAPI)
              che stabilisce un uplink crittografato col frontend.
              Estetica Cyber-Luxury / Data-Art: nero OLED, hairline
              bone-white, un solo accento ambra. Niente pioggia verde.

   Scena    : un icosaedro wireframe ("il Core") sospeso sopra un
              terreno-dati prospettico in ridgeline (Blade Runner 2049),
              orbitato da particelle. L'energia della scena è guidata
              dal progresso di boot (0→1): più il backend si sveglia,
              più il Core accelera, si illumina e respira.

   Audio    : sintesi procedurale pura (zero asset). Drone sub-bass
              detunato con LFO sul filtro (Villeneuve), tick aptici
              a banda stretta sugli eventi di log, "braam" finale
              in caduta di pitch al momento dell'uplink.

   Performance:
   - Canvas 2D singolo, un solo rAF, geometria pre-allocata,
     ZERO allocazioni nel loop di draw.
   - Quality Governor adattivo a 3 tier: misura il frame-time medio
     e degrada DPR/densità finché non tiene i 60fps (vedi sotto).
   - 100dvh + fallback --real-vh, resize intelligente (ignora la
     URL bar iOS), touch-lock sul body, cleanup chirurgico.
════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — palette severa: void / bone / amber
═══════════════════════════════════════════════════════════════ */
const T = {
  void:      '#050505',
  bone:      '#E8E3D8',
  boneDim:   'rgba(232,227,216,0.45)',
  boneGhost: 'rgba(232,227,216,0.14)',
  hairline:  'rgba(232,227,216,0.08)',
  amber:     '#D89C4A',
  amberDim:  'rgba(216,156,74,0.40)',
  amberGhost:'rgba(216,156,74,0.10)',
};
const MONO = "'JetBrains Mono','IBM Plex Mono','ui-monospace','SFMono-Regular',Menlo,monospace";

/* Padding orizzontale unificato — clamp() previene overflow a 320px */
const PX = 'clamp(0.85rem, 4vw, 3rem)';

/* Caratteri usati dal decode-reveal delle righe di log.
   Set ristretto e "tipografico" — niente glitch arcade. */
const DECODE_CHARS = '·:¦/\\—_';


/* ═══════════════════════════════════════════════════════════════
   QUALITY GOVERNOR — tier di qualità per il Canvas
   ───────────────────────────────────────────────────────────────
   Il loop misura il frame-time medio su finestre di 90 frame.
   Se la media supera i 19ms (≈52fps), degrada di un tier:
   meno DPR → meno pixel da riempire (il collo di bottiglia
   reale su mobile è il fill-rate, non la geometria).
   Mobile parte direttamente dal tier 1 per non friggere
   la batteria su device vecchi.
═══════════════════════════════════════════════════════════════ */
const QUALITY_TIERS = [
  { dprCap: 2.0,  terrainCols: 64, terrainRows: 22, particles: 64 },
  { dprCap: 1.5,  terrainCols: 48, terrainRows: 16, particles: 40 },
  { dprCap: 1.0,  terrainCols: 32, terrainRows: 12, particles: 24 },
];
const FRAME_WINDOW   = 90;   // frame per finestra di misura
const FRAME_BUDGET   = 19;   // ms medi oltre i quali si degrada


/* ═══════════════════════════════════════════════════════════════
   GEOMETRIA — icosaedro unitario (12 vertici / 30 spigoli)
   Calcolata UNA volta a module-scope, mai nel render path.
═══════════════════════════════════════════════════════════════ */
function buildIcosahedron() {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw = [
    [-1,  t,  0], [ 1,  t,  0], [-1, -t,  0], [ 1, -t,  0],
    [ 0, -1,  t], [ 0,  1,  t], [ 0, -1, -t], [ 0,  1, -t],
    [ t,  0, -1], [ t,  0,  1], [-t,  0, -1], [-t,  0,  1],
  ];
  // Normalizza sui raggi unitari
  const verts = raw.map(p => {
    const l = Math.hypot(p[0], p[1], p[2]);
    return [p[0] / l, p[1] / l, p[2] / l];
  });
  // Deriva i 30 spigoli unici dalle 20 facce (dedupe via Set)
  const faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];
  const seen = new Set();
  const edges = [];
  for (const [a, b, c] of faces) {
    for (const [i, j] of [[a,b],[b,c],[c,a]]) {
      const key = i < j ? `${i}_${j}` : `${j}_${i}`;
      if (!seen.has(key)) { seen.add(key); edges.push([Math.min(i,j), Math.max(i,j)]); }
    }
  }
  return { verts, edges };
}
const ICO = buildIcosahedron();

/* Pseudo-noise deterministico per il terreno-dati:
   somma di sinusoidi sfasate — zero costo di memoria, look organico */
function ridgeNoise(x, z, t) {
  return Math.sin(x * 2.10 + z * 1.30 + t * 0.50) * 0.45
       + Math.sin(x * 4.70 - z * 2.20 + t * 0.32) * 0.25
       + Math.cos(x * 1.20 + z * 3.10 - t * 0.21) * 0.30;
}


/* ═══════════════════════════════════════════════════════════════
   AUDIO ENGINE "AETHER" — sintesi procedurale pura, zero file
   ───────────────────────────────────────────────────────────────
   Sound design di riferimento: Dune / Blade Runner 2049.
   - drone()     : sub-bass detunato (36.7 / 55.1 / 73.4 Hz) dentro
                   un lowpass la cui frequenza respira via LFO 0.07Hz.
   - tick()      : click aptico — burst di rumore bandpass 10ms,
                   frequenza randomizzata → mai due click uguali.
   - braam()     : impatto finale — sawtooth bassi in caduta di
                   pitch dentro un lowpass che si chiude (600→80Hz),
                   più uno shimmer armonico in quinta, quietissimo.
   - destroy()   : chiusura totale del contesto, zero leak.

   ⚠️ AUTOPLAY POLICY: init() DEVE avvenire dentro un user-gesture.
   Viene chiamato nel primo pointerdown/touchstart del GateScreen —
   il punto più precoce garantito da Safari iOS strict.
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   AUDIO ENGINE "AETHER" — FIX DEFINITIVO PER iOS
═══════════════════════════════════════════════════════════════ */
function createAudioEngine() {
  let ctx = null;
  let master = null;
  let drone = null;

  // 🔥 IL BUG ERA QUI: Non controlliamo più 'running', 
  // perché iOS impiega qualche millisecondo per attivarsi.
  // Controlliamo solo che il contesto esista.
  const ok = () => ctx !== null;

  function init() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!window.audioCtx) window.audioCtx = new Ctx();
      ctx = window.audioCtx; // Assegna il contesto globale alla variabile locale

      // ✨ IL TRUCCO PER iOS: Suoniamo un buffer muto di 1 millisecondo.
      // Questo forza Safari a "svegliare" l'hardware audio all'istante.
      const unlockOsc = ctx.createOscillator();
      const unlockGain = ctx.createGain();
      unlockGain.gain.value = 0; // Invisibile
      unlockOsc.connect(unlockGain);
      unlockGain.connect(ctx.destination);
      unlockOsc.start(ctx.currentTime);
      unlockOsc.stop(ctx.currentTime + 0.001);

      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.knee.value      = 24;
      comp.ratio.value     = 6;
      comp.attack.value    = 0.005;
      comp.release.value   = 0.30;
      master.gain.value    = 0.9;
      master.connect(comp);
      comp.connect(ctx.destination);
    } catch (_) { ctx = null; master = null; }
  }

  function startDrone() {
    if (!ok() || drone) return;
    const now  = ctx.currentTime;
    const gain = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 110;
    filt.Q.value = 0.7;

    const lfo     = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    lfoGain.gain.value  = 45;
    lfo.connect(lfoGain);
    lfoGain.connect(filt.frequency);
    lfo.start(now);

    const oscs = [
      { f: 36.7, type: 'sine',     v: 0.50 },
      { f: 55.1, type: 'sine',     v: 0.32 },
      { f: 73.4, type: 'triangle', v: 0.10 },
    ].map(({ f, type, v }) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      g.gain.value = v;
      osc.connect(g);
      g.connect(filt);
      osc.start(now);
      return osc;
    });

    filt.connect(gain);
    gain.connect(master);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.30, now + 1.8);

    drone = { gain, oscs, lfo };
  }

  function stopDrone(fade = 1.0) {
    if (!ctx || !drone) return;
    const now = ctx.currentTime;
    drone.gain.gain.cancelScheduledValues(now);
    drone.gain.gain.setValueAtTime(Math.max(drone.gain.gain.value, 0.0001), now);
    drone.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    const stopAt = now + fade + 0.1;
    drone.oscs.forEach(o => o.stop(stopAt));
    drone.lfo.stop(stopAt);
    drone = null;
  }

  function tick() {
    if (!ok()) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.010);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.10));
    const src = ctx.createBufferSource();
    const bp  = ctx.createBiquadFilter();
    const g   = ctx.createGain();
    src.buffer = buf;
    bp.type = 'bandpass';
    bp.frequency.value = 2200 + Math.random() * 1400;
    bp.Q.value = 1.2;
    g.gain.value = 0.05;
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(now);
  }

  function braam() {
    if (!ok()) return;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    const lp  = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600, now);
    lp.frequency.exponentialRampToValueAtTime(80, now + 2.8);
    lp.Q.value = 0.9;
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(0.55, now + 0.06);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    lp.connect(out);
    out.connect(master);

    [
      { f: 41.20, type: 'sawtooth', v: 0.50 },
      { f: 61.74, type: 'sawtooth', v: 0.28 },
      { f: 82.40, type: 'triangle', v: 0.18 },
    ].forEach(({ f, type, v }) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, now + 3.0);
      g.gain.value = v;
      osc.connect(g); g.connect(lp);
      osc.start(now); osc.stop(now + 3.3);
    });

    [329.63, 392.00].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      const t0  = now + 0.15 + i * 0.08;
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.035, t0 + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + 2.4);
    });
  }

  function destroy() {
    try { stopDrone(0.05); } catch (_) {}
    
    // ✨ MODIFICA QUI: Commenta o elimina ctx.close()
    // ctx?.close().catch(() => {}); 
    
    // Rimuoviamo solo i riferimenti locali al Preloader, 
    // ma lasciamo vivo window.audioCtx per le altre pagine!
    master = null; 
    drone = null;
  }

  return { init, startDrone, stopDrone, tick, braam, destroy, ok };
}


/* ═══════════════════════════════════════════════════════════════
   LOG LINES — sequenza di boot Uvicorn/FastAPI → neural uplink
   `at` = frazione della durata totale a cui appare la riga
═══════════════════════════════════════════════════════════════ */
const LOG_LINES = [
  { text: 'PYTHON 3.12 — RUNTIME ACQUIRED · THREAD 0',      accent: false, at: 0.02 },
  { text: 'UVICORN 0.30 — ASGI/3 LIFESPAN INIT',            accent: false, at: 0.12 },
  { text: 'FASTAPI ROUTER — 48 ENDPOINTS BOUND',            accent: true,  at: 0.24 },
  { text: 'X25519 KEY EXCHANGE — CHANNEL SEALED',           accent: false, at: 0.38 },
  { text: 'AES-256-GCM — STREAM CIPHER ARMED',              accent: false, at: 0.52 },
  { text: 'WEBSOCKET BRIDGE — FRAME SYNC LOCKED',           accent: true,  at: 0.66 },
  { text: 'TELEMETRY MESH — 12 NODES COHERENT',             accent: false, at: 0.80 },
  { text: 'NEURAL UPLINK ESTABLISHED — HANDOVER',           accent: true,  at: 0.93 },
];

/* Etichette di fase mostrate come eyebrow sopra il counter */
const PHASES = ['HANDSHAKE', 'DECRYPTING', 'SYNCHRONIZING', 'UPLINK LIVE'];
const phaseIndex = p => (p < 25 ? 0 : p < 55 ? 1 : p < 88 ? 2 : 3);


/* ═══════════════════════════════════════════════════════════════
   DECODE LINE — reveal tipografico left→right, niente glitch arcade
═══════════════════════════════════════════════════════════════ */
const DecodeLine = memo(({ text, accent, onReveal }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    onReveal?.(); // un solo tick aptico per riga, non per carattere
    let i = 0;
    const str = String(text);
    const id = setInterval(() => {
      let out = '';
      for (let k = 0; k < str.length; k++) {
        if (str[k] === ' ')      out += ' ';
        else if (k < i)          out += str[k];
        else                     out += DECODE_CHARS[(k * 7 + i * 3) % DECODE_CHARS.length];
      }
      el.textContent = out;
      i += 3;
      if (i >= str.length + 3) { clearInterval(id); el.textContent = str; }
    }, 16);
    return () => clearInterval(id);
  }, [text, onReveal]);

  return (
    <div
      ref={ref}
      style={{
        color: accent ? T.amber : T.boneDim,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontVariantNumeric: 'tabular-nums',
        minWidth: 0, // necessario nei flex children per rispettare l'ellipsis
      }}
    >
      {text}
    </div>
  );
});


/* ═══════════════════════════════════════════════════════════════
   GATE SCREEN — sblocco AudioContext al primissimo touch
   init() su pointerdown E touchstart E click (tripla rete):
   copre Safari iOS strict, vecchi WebView in-app, desktop.
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   GATE SCREEN — sblocco AudioContext al primissimo touch
═══════════════════════════════════════════════════════════════ */
function GateScreen({ onEnter, audioRef }) {
  const gateRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    const tween = gsap.fromTo(
      textRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 1.4, ease: 'expo.out', delay: 0.25, force3D: true }
    );
    return () => tween.kill();
  }, []);

  const initAudio = useCallback(() => {
    if (audioRef.current && typeof audioRef.current.init === 'function') {
      audioRef.current.init();
    }
  }, [audioRef]);

  const handleClick = () => {
    initAudio(); 
    
    // Suona subito per aggirare i blocchi di iOS!
    if (audioRef.current && typeof audioRef.current.startDrone === 'function') {
      audioRef.current.startDrone();
    }

    gsap.to(gateRef.current, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.in',
      force3D: true,
      onComplete: onEnter,
    });
  };

  return (
    <div
      ref={gateRef}
      onPointerDown={initAudio}
      onTouchStart={initAudio}
      onClick={handleClick}
      style={{
        position: 'absolute', inset: 0, zIndex: 30,
        background: T.void,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', userSelect: 'none',
        willChange: 'opacity',
      }}
    >
      {/* Crosshair '+' agli angoli — registri da blueprint */}
      {[
        { top: '1.6rem', left: '1.6rem' }, { top: '1.6rem', right: '1.6rem' },
        { bottom: '1.6rem', left: '1.6rem' }, { bottom: '1.6rem', right: '1.6rem' },
      ].map((pos, i) => (
        <span key={i} aria-hidden style={{
          position: 'absolute', ...pos,
          fontFamily: MONO, fontSize: '0.8rem',
          color: T.boneGhost, lineHeight: 1,
        }}>+</span>
      ))}

      <div
        ref={textRef}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '1.6rem', opacity: 0, textAlign: 'center',
          padding: `0 ${PX}`, width: '100%', boxSizing: 'border-box',
        }}
      >
        <div style={{
          fontFamily: MONO, fontSize: 'clamp(0.5rem, 1vw, 0.62rem)',
          color: T.boneDim, letterSpacing: '0.28em', textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
        }}>
          SEBASTIANO MOLLO — CREATIVE DEVELOPER
        </div>

        {/* ✨ NUOVO: Modulo Premium "Alza il Volume" */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          marginBottom: '-0.4rem', // Avvicina leggermente questo blocco al pulsante principale
          color: T.amber, opacity: 0.85
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
          <span style={{
            fontFamily: MONO, fontSize: 'clamp(0.48rem, 1vw, 0.58rem)',
            letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>
            Alza il volume
          </span>
        </div>

        <div className="gate-cta" style={{
          fontFamily: MONO,
          fontSize: 'clamp(0.72rem, 1.8vw, 1rem)',
          color: T.bone, letterSpacing: '0.3em', textTransform: 'uppercase',
          wordBreak: 'break-word',
        }}>
          [ ESTABLISH UPLINK ]
        </div>

        <div style={{
          fontFamily: MONO, fontSize: 'clamp(0.46rem, 0.9vw, 0.56rem)',
          color: T.boneGhost, letterSpacing: '0.22em', textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
        }}>
          ENCRYPTED AUDIO / VISUAL HANDSHAKE — TAP TO AUTHORIZE
        </div>
      </div>

      <style>{`
        /* Pulse sinusoidale lento — premium, niente blink step-end */
        .gate-cta { animation: gatePulse 2.6s cubic-bezier(0.45, 0, 0.55, 1) infinite; }
        @keyframes gatePulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @media (prefers-reduced-motion: reduce) { .gate-cta { animation: none; } }
      `}</style>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   MONOLITH SCENE — Canvas 2D: terreno-dati + Core icosaedrico
   ───────────────────────────────────────────────────────────────
   props (via ref, MAI via state → zero re-render React):
   - energyRef : 0..1, progresso di boot → guida velocità/alpha
   - flareRef  : 0..1, flash bianco dell'exit sequence
   - reduced   : prefers-reduced-motion → frame statico singolo
═══════════════════════════════════════════════════════════════ */
const MonolithScene = memo(({ energyRef, flareRef, reduced }) => {
  const cvRef = useRef(null);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx2d = cv.getContext('2d', { alpha: false }); // opaco = compositing più economico

    /* ── Stato del Quality Governor ─────────────────────────── */
    const isMobile = window.innerWidth < 768;
    let tierIdx = isMobile ? 1 : 0; // mobile parte già conservativo
    let tier    = QUALITY_TIERS[tierIdx];
    let frameAcc = 0, frameCount = 0;

    /* ── Dimensioni cache (nessuna lettura DOM nel loop) ────── */
    let W = 0, H = 0, dpr = 1;

    /* ── Buffer pre-allocati per la proiezione del Core ──────
       12 vertici × (x,y) × 2 gusci (outer bone + inner amber).
       Allocati UNA volta: il loop scrive solo dentro questi.   */
    const projOuter = new Float32Array(ICO.verts.length * 2);
    const projInner = new Float32Array(ICO.verts.length * 2);

    /* ── Particelle orbitali (parametri fissi, posizioni derivate) ── */
    const MAX_P = QUALITY_TIERS[0].particles;
    const pR    = new Float32Array(MAX_P); // raggio orbita
    const pS    = new Float32Array(MAX_P); // velocità angolare
    const pPh   = new Float32Array(MAX_P); // fase iniziale
    const pIn   = new Float32Array(MAX_P); // inclinazione orbita
    for (let i = 0; i < MAX_P; i++) {
      pR[i]  = 1.45 + Math.random() * 0.9;
      pS[i]  = (0.10 + Math.random() * 0.25) * (Math.random() > 0.5 ? 1 : -1);
      pPh[i] = Math.random() * Math.PI * 2;
      pIn[i] = (Math.random() - 0.5) * 1.6;
    }

    const setup = () => {
      W   = window.innerWidth;
      H   = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, tier.dprCap);
      cv.width  = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      ctx2d.scale(dpr, dpr);
    };
    setup();

    /* ── Proiezione prospettica minimale ────────────────────── */
    const FOV = 3.4;

    let ax = 0.35, ay = 0; // angoli di rotazione del Core
    let raf = 0;
    let prevTs = 0;

    const draw = (ts) => {
      raf = requestAnimationFrame(draw);
      if (!prevTs) prevTs = ts;
      const dt = Math.min((ts - prevTs) / 1000, 0.05); // clamp anti-salto da tab inattiva
      prevTs = ts;

      const time   = ts / 1000;
      const energy = energyRef.current; // 0..1
      const flare  = flareRef.current;  // 0..1

      /* ── Quality Governor: misura e degrada se serve ──────── */
      frameAcc += dt * 1000;
      frameCount++;
      if (frameCount >= FRAME_WINDOW) {
        const avg = frameAcc / frameCount;
        frameAcc = 0; frameCount = 0;
        if (avg > FRAME_BUDGET && tierIdx < QUALITY_TIERS.length - 1) {
          tierIdx++;
          tier = QUALITY_TIERS[tierIdx];
          setup(); // riapplica il nuovo DPR cap
        }
      }

      /* ── Clear (canvas opaco → fill pieno, no trasparenza) ── */
      ctx2d.fillStyle = T.void;
      ctx2d.fillRect(0, 0, W, H);

      const cx = W * 0.5;
      const cy = H * 0.42;
      const coreScale = Math.min(W, H) * (0.16 + energy * 0.03);

      /* ════ 1 · TERRENO-DATI (ridgeline prospettiche) ════════ */
      const horizon = H * 0.62;
      const camH    = H * 0.46;
      const rows    = tier.terrainRows;
      const cols    = tier.terrainCols;
      const tAmp    = H * 0.055 * (0.55 + energy * 0.45);
      ctx2d.lineWidth = 1;
      ctx2d.strokeStyle = T.bone;
      for (let j = 0; j < rows; j++) {
        const tz    = j / (rows - 1);          // 0 = vicino, 1 = lontano
        const zd    = 1 + tz * 6;              // profondità
        const persp = 1 / zd;
        const rowY  = horizon + camH * persp;
        const spread = W * 0.95 * (0.4 + persp * 1.6);
        ctx2d.globalAlpha = (0.04 + 0.16 * (1 - tz)) * (0.5 + energy * 0.5);
        ctx2d.beginPath();
        for (let i = 0; i <= cols; i++) {
          const txn  = (i / cols) * 2 - 1;     // -1..1
          // Maschera centrale: il terreno si placa sotto il Core
          const mask = Math.min(1, Math.abs(txn) * 1.5 + 0.12);
          const yOff = ridgeNoise(txn * 3, zd, time) * tAmp * persp * mask;
          const x    = cx + txn * spread;
          const y    = rowY - yOff;
          if (i === 0) ctx2d.moveTo(x, y);
          else         ctx2d.lineTo(x, y);
        }
        ctx2d.stroke();
      }

      /* ════ 2 · SCAN SWEEP (hairline ambra che scende) ═══════ */
      const sweepY = ((time * 0.045) % 1.25 - 0.12) * H;
      ctx2d.globalAlpha = 0.07 + energy * 0.05;
      ctx2d.strokeStyle = T.amber;
      ctx2d.beginPath();
      ctx2d.moveTo(0, sweepY);
      ctx2d.lineTo(W, sweepY);
      ctx2d.stroke();

      /* ════ 3 · IL CORE (icosaedro doppio guscio) ════════════ */
      // La velocità di rotazione cresce con l'energia: il backend
      // "si sveglia" e il Core accelera.
      const spin = 0.10 + energy * 0.55;
      ax += dt * spin * 0.7;
      ay += dt * spin;

      const ca = Math.cos(ax), sa = Math.sin(ax);
      const cb = Math.cos(ay), sb = Math.sin(ay);

      // Proietta i 12 vertici nei due gusci (outer 1.0 / inner 0.55,
      // l'inner controruota usando -ay → basta invertire sb)
      for (let i = 0; i < ICO.verts.length; i++) {
        const v = ICO.verts[i];
        // — guscio esterno: rotY(ay) poi rotX(ax)
        let x1 = v[0] * cb + v[2] * sb;
        let z1 = -v[0] * sb + v[2] * cb;
        let y1 = v[1] * ca - z1 * sa;
        let z2 = v[1] * sa + z1 * ca;
        let s  = FOV / (FOV - z2);
        projOuter[i * 2]     = cx + x1 * s * coreScale;
        projOuter[i * 2 + 1] = cy + y1 * s * coreScale;
        // — guscio interno: controrotazione (-ay), scala 0.55
        x1 = v[0] * cb - v[2] * sb;
        z1 = v[0] * sb + v[2] * cb;
        y1 = v[1] * ca - z1 * sa;
        z2 = v[1] * sa + z1 * ca;
        s  = FOV / (FOV - z2);
        projInner[i * 2]     = cx + x1 * s * coreScale * 0.55;
        projInner[i * 2 + 1] = cy + y1 * s * coreScale * 0.55;
      }

      // Spigoli outer — hairline bone
      ctx2d.globalAlpha = 0.22 + energy * 0.45;
      ctx2d.strokeStyle = T.bone;
      ctx2d.beginPath();
      for (let e = 0; e < ICO.edges.length; e++) {
        const [a, b] = ICO.edges[e];
        ctx2d.moveTo(projOuter[a * 2], projOuter[a * 2 + 1]);
        ctx2d.lineTo(projOuter[b * 2], projOuter[b * 2 + 1]);
      }
      ctx2d.stroke();

      // Spigoli inner — ambra, più tenue
      ctx2d.globalAlpha = 0.10 + energy * 0.30;
      ctx2d.strokeStyle = T.amber;
      ctx2d.beginPath();
      for (let e = 0; e < ICO.edges.length; e++) {
        const [a, b] = ICO.edges[e];
        ctx2d.moveTo(projInner[a * 2], projInner[a * 2 + 1]);
        ctx2d.lineTo(projInner[b * 2], projInner[b * 2 + 1]);
      }
      ctx2d.stroke();

      // Vertici outer — punti 2×2 (fillRect: più economico di arc)
      ctx2d.globalAlpha = 0.5 + energy * 0.5;
      ctx2d.fillStyle = T.bone;
      for (let i = 0; i < ICO.verts.length; i++) {
        ctx2d.fillRect(projOuter[i * 2] - 1, projOuter[i * 2 + 1] - 1, 2, 2);
      }

      /* ════ 4 · PARTICELLE ORBITALI ══════════════════════════ */
      const nP = tier.particles;
      ctx2d.fillStyle = T.amber;
      for (let i = 0; i < nP; i++) {
        const ang = pPh[i] + time * pS[i] * (0.5 + energy);
        const x0  = Math.cos(ang) * pR[i];
        const z0  = Math.sin(ang) * pR[i];
        const ci  = Math.cos(pIn[i]), si = Math.sin(pIn[i]);
        const y0  = -z0 * si;
        const zz  = z0 * ci;
        const s   = FOV / (FOV - zz);
        ctx2d.globalAlpha = (0.10 + 0.25 * ((s - 0.7) / 0.8)) * (0.3 + energy * 0.7);
        ctx2d.fillRect(
          cx + x0 * s * coreScale - 0.75,
          cy + y0 * s * coreScale - 0.75,
          1.5, 1.5
        );
      }

      /* ════ 5 · FLARE (flash dell'exit sequence) ═════════════ */
      if (flare > 0.003) {
        ctx2d.globalAlpha = flare * 0.9;
        ctx2d.fillStyle = T.bone;
        ctx2d.fillRect(0, 0, W, H);
      }
      ctx2d.globalAlpha = 1;
    };

    if (reduced) {
      // Accessibilità: un singolo frame statico, niente loop
      draw(16);
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(draw);
    }

    /* ── RESIZE intelligente ─────────────────────────────────
       Ignora i resize puramente verticali (URL bar iOS che
       appare/scompare durante lo scroll). Reagisce solo a
       variazioni di width > 30px o cambio orientamento.       */
    let prevW = window.innerWidth;
    let prevOrient = window.innerWidth > window.innerHeight ? 'l' : 'p';
    let resizeTimer = 0;
    const handleResize = () => {
      const nw = window.innerWidth;
      const no = window.innerWidth > window.innerHeight ? 'l' : 'p';
      if (Math.abs(nw - prevW) <= 30 && no === prevOrient) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        prevW = nw; prevOrient = no;
        setup();
        if (reduced) draw(16); // ridisegna il frame statico
      }, 200);
    };

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleResize);
      ro.observe(document.documentElement);
    } else {
      window.addEventListener('resize', handleResize, { passive: true });
    }

    return () => {
      // Cleanup chirurgico: rAF + timer + observer
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', handleResize);
    };
  }, [energyRef, flareRef, reduced]);

  return (
    <canvas
      ref={cvRef}
      aria-hidden
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        zIndex: 1, pointerEvents: 'none',
      }}
    />
  );
});


/* ═══════════════════════════════════════════════════════════════
   MAIN PRELOADER
═══════════════════════════════════════════════════════════════ */
export default function Preloader({ onComplete }) {
  const containerRef    = useRef(null);
  const fillRef         = useRef(null);
  const numRef          = useRef(null);
  const phaseRef        = useRef(null);
  const counterMaskRef  = useRef(null);
  const logsBoxRef      = useRef(null);
  const statusRef       = useRef(null);
  const audioRef        = useRef(null);
  const exitRef         = useRef(null);

  /* Canali numerici verso il canvas — refs, MAI state:
     il canvas li legge a 60fps senza re-render React */
  const energyRef = useRef(0);
  const flareRef  = useRef(0);

  const [booting, setBooting] = useState(false);
  const [logs, setLogs]       = useState([]);

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const onLogReveal = useCallback(() => { audioRef.current?.tick(); }, []);

  /* ── [VH] Fallback --real-vh per Safari iOS < 15.4 ─────────── */
  useEffect(() => {
    const setRealVH = () => {
      document.documentElement.style.setProperty('--real-vh', `${window.innerHeight}px`);
    };
    setRealVH();
    window.addEventListener('resize', setRealVH, { passive: true });
    return () => window.removeEventListener('resize', setRealVH);
  }, []);

  /* ── [LOCK] Blocco scroll/rubber-banding durante il preload ── */
  useEffect(() => {
    const body = document.body;
    const prev = {
      overscrollBehavior: body.style.overscrollBehavior,
      touchAction:        body.style.touchAction,
      overflow:           body.style.overflow,
    };
    body.style.overscrollBehavior = 'none';
    body.style.touchAction        = 'none';
    body.style.overflow           = 'hidden';
    return () => {
      body.style.overscrollBehavior = prev.overscrollBehavior;
      body.style.touchAction        = prev.touchAction;
      body.style.overflow           = prev.overflow;
    };
  }, []);

  /* ── [AUDIO] Distruzione totale del contesto al dismount ───── */
  useEffect(() => {
    return () => { audioRef.current?.destroy(); audioRef.current = null; };
  }, []);

  /* ── EXIT SEQUENCE ──────────────────────────────────────────
     1. pointer-events off (il preloader smette di catturare input)
     2. braam audio + drone fade-out
     3. flare bianco sul canvas (via flareRef, tweenata da GSAP)
     4. il counter scivola su dentro la maschera
     5. iris collapse: clip-path verso la linea centrale
     6. estinzione, rimozione will-change, onComplete            */
  const exitSequence = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.pointerEvents = 'none'; // chirurgico: da qui il sito sotto è già interattivo

    audioRef.current?.stopDrone(0.9);
    audioRef.current?.braam();

    const finish = () => {
      el.style.willChange = '';
      onComplete?.();
    };

    if (reducedMotion) {
      gsap.to(el, { opacity: 0, duration: 0.6, force3D: true, onComplete: finish });
      return;
    }

    const tl = gsap.timeline({ onComplete: finish });
    tl
      // Flash del Core — tweena direttamente flareRef.current (il canvas la legge)
      .to(flareRef, { current: 1, duration: 0.10, ease: 'power2.in' })
      .to(flareRef, { current: 0, duration: 0.55, ease: 'power2.out' })
      // Il counter esce verso l'alto dentro la maschera
      .to(counterMaskRef.current, {
        yPercent: -115, duration: 0.6, ease: 'expo.in', force3D: true,
      }, '-=0.55')
      // Iris collapse del contenitore
      .to(el, {
        clipPath: 'inset(49.8% 0% 49.8% 0%)',
        duration: 0.65, ease: 'expo.inOut', force3D: true,
      }, '-=0.25')
      .to(el, { opacity: 0, duration: 0.22, ease: 'power2.out', force3D: true }, '-=0.10');
  }, [reducedMotion, onComplete]);

  exitRef.current = exitSequence;

  /* ── GATE ENTER → avvia drone + boot ───────────────────────── */
  const handleGateEnter = useCallback(() => {
    if (!audioRef.current) {
      const audio = createAudioEngine();
      audio.init();
      audioRef.current = audio;
    }
    // Ho rimosso la riga che faceva partire il drone qui in ritardo
    setBooting(true);
  }, []);
  /* ── BOOT SEQUENCE ─────────────────────────────────────────── */
  useEffect(() => {
    if (!booting) return;

    const state = { p: 0 };
    const DUR   = reducedMotion ? 1.2 : 4.4;
    let lastPhase = -1;

    const gsapCtx = gsap.context(() => {
      gsap.timeline({
        onComplete: () => {
          if (statusRef.current) statusRef.current.textContent = '● UPLINK LIVE';
          gsap.delayedCall(0.5, () => exitRef.current?.());
        },
      }).to(state, {
        p: 100,
        duration: DUR,
        ease: 'power2.inOut',
        onUpdate: () => {
          const v = Math.floor(state.p);
          energyRef.current = state.p / 100; // il canvas legge questo a 60fps
          if (numRef.current)  numRef.current.textContent = String(v).padStart(3, '0');
          if (fillRef.current) fillRef.current.style.transform = `scaleX(${state.p / 100})`;
          const ph = phaseIndex(v);
          if (ph !== lastPhase && phaseRef.current) {
            lastPhase = ph;
            phaseRef.current.textContent = PHASES[ph];
          }
        },
      });

      LOG_LINES.forEach(log => {
        gsap.delayedCall(log.at * DUR, () => setLogs(prev => [...prev, log]));
      });
    }, containerRef);

    return () => gsapCtx.revert();
  }, [booting, reducedMotion]);

  /* ── Auto-scroll del log box ───────────────────────────────── */
  useEffect(() => {
    const el = logsBoxRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [logs]);

  return (
    <div
      ref={containerRef}
      className="uplink-pre"
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%',
        // height gestita da .uplink-pre (100dvh + fallback --real-vh)
        backgroundColor: T.void,
        fontFamily: MONO,
        overflow: 'hidden',
        clipPath: 'inset(0% 0% 0% 0%)',
        color: T.bone,
        touchAction: 'none',
        overscrollBehavior: 'none',
        willChange: 'clip-path, opacity',
        zIndex: 9999,
      }}
    >
      {/* Gate — sblocca l'audio al primo touch */}
      {!booting && <GateScreen onEnter={handleGateEnter} audioRef={audioRef} />}

      {/* Scena canvas — già viva (idle) dietro il gate */}
      <MonolithScene energyRef={energyRef} flareRef={flareRef} reduced={reducedMotion} />

      {/* Vignettatura statica — CSS, nessun costo per frame */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 42%, transparent 30%, rgba(0,0,0,0.7) 100%)',
      }} />

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: `1rem ${PX}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${T.hairline}`,
        fontSize: 'clamp(0.5rem, 1.1vw, 0.6rem)',
        color: T.boneDim, letterSpacing: '0.22em', textTransform: 'uppercase',
        zIndex: 10, gap: '0.75rem',
      }}>
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          minWidth: 0, flexShrink: 1,
        }}>
          SM—26 // NEURAL UPLINK
        </span>
        <span ref={statusRef} style={{
          color: T.amber, letterSpacing: '0.14em',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          ● SYNCHRONIZING
        </span>
      </div>

      {/* ── PANNELLO INFERIORE: counter + logs ──────────────── */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: `0 ${PX} clamp(1.4rem, 4svh, 3rem)`,
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
        gap: 'clamp(0.9rem, 3svh, 1.6rem)',
        zIndex: 10,
      }}>

        <div className="uplink-row" style={{
          display: 'flex', alignItems: 'flex-end',
          justifyContent: 'space-between', gap: '1.5rem',
        }}>
          {/* Counter — tipografia cinetica massiccia, mascherata */}
          <div style={{ flexShrink: 0, minWidth: 0 }}>
            <div ref={phaseRef} style={{
              fontSize: 'clamp(0.46rem, 1vw, 0.58rem)',
              color: T.amber, letterSpacing: '0.34em', textTransform: 'uppercase',
              marginBottom: '0.7rem',
            }}>
              HANDSHAKE
            </div>
            <div style={{ overflow: 'hidden' /* maschera per l'exit slide-up */ }}>
              <div ref={counterMaskRef} style={{
                display: 'flex', alignItems: 'baseline',
                willChange: 'transform',
              }}>
                <span ref={numRef} style={{
                  fontSize: 'clamp(4rem, 16vw, 11rem)',
                  fontWeight: 300, lineHeight: 0.88,
                  color: T.bone, letterSpacing: '-0.05em',
                  fontVariantNumeric: 'tabular-nums',
                  willChange: 'contents',
                }}>
                  000
                </span>
                <span style={{
                  fontSize: 'clamp(0.9rem, 2.4vw, 1.6rem)',
                  color: T.amber, marginLeft: '0.5rem', fontWeight: 300,
                }}>
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Log box — micro-tipografia, decode reveal */}
          <div
            ref={logsBoxRef}
            style={{
              flex: '0 1 380px', minWidth: 0,
              height: 'clamp(96px, 20svh, 168px)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
              gap: '0.42rem',
              fontSize: 'clamp(0.5rem, 1.05vw, 0.66rem)',
              lineHeight: 1.5, letterSpacing: '0.08em',
              textTransform: 'uppercase',
              borderLeft: `1px solid ${T.hairline}`,
              paddingLeft: 'clamp(0.7rem, 2vw, 1.2rem)',
              boxSizing: 'border-box',
            }}
          >
            {logs.map((log, i) => (
              <DecodeLine key={i} text={log.text} accent={log.accent} onReveal={onLogReveal} />
            ))}
          </div>
        </div>

        {/* Progress hairline — scaleX, GPU-only */}
        <div style={{
          width: '100%', height: '1px',
          background: T.hairline, position: 'relative', overflow: 'hidden',
        }}>
          <div
            ref={fillRef}
            style={{
              position: 'absolute', inset: 0,
              background: T.bone,
              transform: 'scaleX(0)',
              transformOrigin: 'left center',
              willChange: 'transform',
            }}
          />
        </div>

        {/* Footer micro-dati — nascosto su mobile */}
        <div className="hide-mobile" style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: '0.52rem', color: T.boneGhost,
          letterSpacing: '0.24em', textTransform: 'uppercase',
        }}>
          <span>NODE 45.0703°N / 7.6869°E</span>
          <span>AES-256-GCM — CHANNEL SEALED</span>
          <span>SM © 2026</span>
        </div>
      </div>

      <style>{`
        /* ── VIEWPORT HEIGHT ──────────────────────────────────
           100dvh segue la URL bar di iOS Safari (15.4+).
           Fallback: --real-vh calcolata via JS per i legacy. */
        .uplink-pre { height: 100svh; }
        @supports not (height: 1svh) {
          .uplink-pre { height: var(--real-vh, 100svh); }
        }

        /* ── MOBILE COLLAPSE ──────────────────────────────────
           Sotto i 768px la riga counter/logs si impila:
           counter sopra, log sotto a piena larghezza.        */
        @media (max-width: 767px) {
          .hide-mobile { display: none !important; }
          .uplink-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 1rem !important;
          }
          .uplink-row > div:last-child {
            flex: 0 0 auto !important;
            height: clamp(80px, 16svh, 120px) !important;
            border-left: none !important;
            border-top: 1px solid ${T.hairline} !important;
            padding-left: 0 !important;
            padding-top: 0.8rem !important;
          }
        }
      `}</style>
    </div>
  );
}