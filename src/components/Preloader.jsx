import { useEffect, useRef, useState, useCallback, memo } from 'react';
import gsap from 'gsap';

/* ════════════════════════════════════════════════════════════════════
   PRELOADER — "GHOST PROTOCOL / DATA GENESIS"
   ────────────────────────────────────────────────────────────────────
   Sequenza cinematica in 5 atti:

     0 · GATE       Schermo nero. Sblocco audio dentro lo user-gesture.
     1 · BOOT       Terminale: typing realistico, glitch, cursore, CRT.
     2 · RAIN       Pioggia digitale originale (glifi/simboli/token) con
                    campo magnetico attorno al cursore. Colonne che
                    accelerano, rallentano, muoiono, ripartono.
     3 · GENESIS    La pioggia si ferma, i caratteri si sgretolano in
                    particelle che ruotano, convergono e COMPONGONO
                    la parola SEBAMOX partendo dai dati stessi.
     4 · EXIT       Il logo esplode in particelle, il fondo si dissolve
                    e l'Hero del sito emerge senza stacco.

   ─────────────────────────────────────────────────────────────────
   ARCHITETTURA DEL TEMPO (la chiave della sincronia audio/video)
   ─────────────────────────────────────────────────────────────────
   Esiste UN SOLO orologio: la "show clock", avanzata dal rAF del
   canvas con delta-time CLAMPATO. Tutta la coreografia (audio, fasi,
   tween DOM) è una coda di eventi ordinata letta su quella stessa
   clock, nello stesso frame in cui il canvas disegna.

   Conseguenze, tutte volute:
   • Un evento audio e il fotogramma che gli corrisponde partono nello
     STESSO frame → sincronia esatta per costruzione, non per fortuna.
   • Se la tab va in background il rAF si ferma: la clock si congela e
     NESSUN evento si accumula. Al ritorno lo show riparte esattamente
     da dov'era. (Con gsap.delayedCall + ticker.lagSmoothing(0) — che
     main.jsx imposta — al ritorno sarebbero scattati TUTTI insieme:
     braam, glitch e data-burst sovrapposti. Bug reale, eliminato.)
   • L'AudioContext viene sospeso/ripreso con la visibilità, quindi
     nemmeno il drone va alla deriva rispetto al video.

   Performance:
   - UN canvas 2D, UN rAF, UNA clock, ZERO allocazioni nel draw loop.
   - Atlante di glifi pre-renderizzato con coordinate sorgente già in
     pixel-device: drawImage senza shaping né moltiplicazioni per frame.
   - Particelle disegnate in BATCH per livello di alpha: ~12 draw call
     invece di ~5200 (una fillRect per particella spezza il batching
     di Skia a ogni cambio di globalAlpha).
   - Scia troncata con `break` appena esce dallo schermo, alpha testata
     PRIMA della matematica del campo magnetico.
   - Quality Governor adattivo, ma congelato dopo la fase RAIN: un
     cambio di tier durante la genesi rimapperebbe i target del logo.
   - Buffer audio pre-generati: nessuna allocazione durante il typing.
   - Fuori dal canvas si animano SOLO transform e opacity.

   COMPATIBILITÀ SITO (preservata):
   - lock scroll su <body> con SALVATAGGIO/RIPRISTINO esatto degli
     stili precedenti → la barra di scorrimento destra e lo scroll di
     TUTTO il sito tornano attivi appena il preloader si smonta.
   - fallback --real-vh per Safari iOS legacy.
   - pointer-events disattivati all'inizio dell'exit → il sito sotto
     è già interattivo mentre il preloader svanisce.
   - window.audioCtx condiviso: NON viene chiuso al dismount, e la
     catena master viene MEMOIZZATA sul contesto (un remount non ne
     costruisce una seconda che raddoppierebbe il volume).
   - listener puntatore/touch tutti PASSIVI: nessuna trappola sul
     touchmove, il compositor scroll del sito resta intatto.
════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — void / bone / emerald
═══════════════════════════════════════════════════════════════ */
const T = {
  void:        '#040605',
  bone:        '#E8E9E6',
  boneDim:     'rgba(232,233,230,0.46)',
  boneGhost:   'rgba(232,233,230,0.13)',
  hairline:    'rgba(232,233,230,0.07)',
  emerald:     '#2BE08C',
  emeraldSoft: 'rgba(43,224,140,0.42)',
  pale:        '#D6FFE9',
};

const MONO    = "'JetBrains Mono','IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace";
const DISPLAY = "'Geist Sans','Geist',system-ui,-apple-system,sans-serif";

/* Padding orizzontale unificato — clamp() previene overflow a 320px */
const PX = 'clamp(0.9rem, 4vw, 3.25rem)';

const LOGO_TEXT = 'SEBAMOX';

/* Caratteri del micro-glitch sulla testina di scrittura */
const GLITCH_CH = '▚▞▜▛/\\|_¦·';


/* ═══════════════════════════════════════════════════════════════
   GLIFI DELLA PIOGGIA — linguaggio simbolico originale
   ───────────────────────────────────────────────────────────────
   Nessun alfabeto o asset protetto: solo sintassi di programmazione,
   operatori matematici, lettere greche, cifre binarie e blocchi.
═══════════════════════════════════════════════════════════════ */
const GLYPH_SHORT = [
  '<', '>', '{', '}', '[', ']', '(', ')', '/', '\\', '|', '·', ':', ';',
  '=', '+', '-', '*', '^', '~', '#', '$', '%', '&', '?', '!', '@', '_',
  'Σ', 'Λ', 'π', '∞', '∆', '∇', 'Ω', 'Φ', 'Ψ', 'µ', '≡', '≠', '≈', '√',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '█', '▓', '▒', '░', '▖', '▙', '▟', '▛',
];
const GLYPH_WORD = [
  'AI', 'CSS', 'HTML', 'JS', 'API', 'NODE', 'BUILD', 'DEPLOY',
  'SYSTEM', 'NETWORK', 'CREATE', 'GPU', 'SHA', '0x1F', 'SYNC', 'NULL',
];
const GLYPHS  = [...GLYPH_SHORT, ...GLYPH_WORD];
const SHORT_N = GLYPH_SHORT.length;
const TOTAL_N = GLYPHS.length; // 74 < 256 → gli id stanno in un Uint8Array

/* Picker pesato: la colonna resta "tecnica" e leggibile, le parole
   compaiono come segnali rari dentro il flusso di dati. */
function pickGlyph() {
  return Math.random() < 0.88
    ? (Math.random() * SHORT_N) | 0
    : SHORT_N + ((Math.random() * (TOTAL_N - SHORT_N)) | 0);
}


/* ═══════════════════════════════════════════════════════════════
   QUALITY GOVERNOR
   ───────────────────────────────────────────────────────────────
   Il loop misura il frame-time medio su finestre di 90 frame: se
   supera i 19ms (≈52fps) degrada di un tier. Il collo di bottiglia
   reale è il fill-rate, quindi il primo parametro sacrificato è il
   DPR, poi la densità di glifi e particelle.
═══════════════════════════════════════════════════════════════ */
const QUALITY_TIERS = [
  { dprCap: 2.0, cellW: 19, fontPx: 17, particles: 2600, stride: 3, trail: 26 },
  { dprCap: 1.5, cellW: 22, fontPx: 16, particles: 1500, stride: 4, trail: 20 },
  { dprCap: 1.0, cellW: 26, fontPx: 15, particles: 850,  stride: 5, trail: 15 },
];
const FRAME_WINDOW = 90;
const FRAME_BUDGET = 19;

/* Livelli di quantizzazione dell'alpha per il batching delle
   particelle. 8 livelli sul corpo + 4 sul nucleo = 12 draw call
   totali; la scalinatura è invisibile perché le particelle sono
   sovrapposte in blending additivo. */
const A_LEVELS = 8;
const C_LEVELS = 4;

/* Durate della coreografia (secondi di show-clock) */
const D = {
  boot:     3.0,
  rain:     2.9,
  converge: 2.05,
  // `reveal` copre l'ingresso della tagline (≈1.55s dall'inizio della
  // fase) PIÙ il tempo di contemplazione. Il respiro del logo continua,
  // quindi la pausa non è mai statica: è un fermo-immagine vivo.
  reveal:   3.1,
  exit:     1.35,
};
const D_REDUCED = {
  boot:     1.0,
  rain:     0.0,
  converge: 0.7,
  reveal:   1.9,
  exit:     0.7,
};

/* Clamp del delta-time. Oltre questa soglia il frame è considerato
   "perso" (GC, tab in background, long task) e la show-clock avanza
   solo del clamp: nessun salto, nessuna raffica di eventi accumulati. */
const DT_CLAMP         = 0.05;  // 20fps: sotto, lo show rallenta invece di saltare
const DT_CLAMP_REDUCED = 0.20;  // profilo reduced-motion: polling a 120ms


/* ═══════════════════════════════════════════════════════════════
   EASING — curve cinematiche, nessun linear / ease-in-out
═══════════════════════════════════════════════════════════════ */
const easeOutExpo  = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInOutCub = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01      = v => (v < 0 ? 0 : v > 1 ? 1 : v);


/* ═══════════════════════════════════════════════════════════════
   AUDIO ENGINE "GHOST" — sintesi procedurale, zero file
   ───────────────────────────────────────────────────────────────
   CATENA MASTER:
      [sorgenti] → bus → glue(WaveShaper tanh) → limiter → master → out

   • bus     : punto di somma caldo, tutte le voci ci sbattono dentro.
   • glue    : soft-clip trasparente che arrotonda i picchi PRIMA del
               limiter e ricostruisce la fondamentale mancante (i sub
               si sentono anche sugli speaker dei telefoni).
   • limiter : DynamicsCompressor in configurazione BRICKWALL —
               threshold −1.5dBFS, knee 0, ratio 20:1, attack 2ms.
               Tiene i picchi sotto 0dBFS: forte ma mai sgradevole.

   La catena è MEMOIZZATA sull'AudioContext condiviso: un remount del
   preloader (HMR, StrictMode, route) riusa quella esistente invece di
   costruirne una seconda in parallelo — che raddoppierebbe il volume
   e lascerebbe nodi orfani attaccati a destination.
═══════════════════════════════════════════════════════════════ */

/* Curve di saturazione pre-calcolate (tanh): niente Math nel grafo. */
function buildSatCurve(drive, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * drive);
  }
  return c;
}
const SAT_WARM  = buildSatCurve(2.6); // ottoni del braam: caldo, "a valvole"
const SAT_GLUE  = buildSatCurve(1.1); // bus: collante quasi trasparente
const SAT_CRUSH = buildSatCurve(9.0); // glitch: distorsione dura

/* Lookahead di scheduling. Far partire una sorgente esattamente a
   ctx.currentTime significa cadere a metà del blocco da 128 sample in
   corso: il transiente viene troncato e si sente un click irregolare.
   6ms di anticipo garantiscono un attacco pulito e IDENTICO ogni volta
   — è precisione, non latenza (impercettibile). */
const LOOK = 0.006;

function createAudioEngine() {
  let ctx     = null;
  let bus     = null;
  let limiter = null;
  let master  = null;
  let drone   = null;
  let amb     = null;

  /* Buffer pre-generati UNA volta: durante il typing partono decine di
     tick e allocare/riempire un AudioBuffer per ognuno produrrebbe
     garbage a raffica proprio mentre il canvas deve tenere i 60fps. */
  let bufNoise   = null;  // 2s di rumore bianco, in loop
  let bufTick    = null;  // 6ms, click della tastiera
  let bufImpact  = null;  // 50ms, transiente del braam
  let bufGlitch  = null;  // 3 varianti da 90ms, interferenza

  const ok = () => ctx !== null && bus !== null;

  function buildBuffers() {
    const sr = ctx.sampleRate;

    const nLen = Math.floor(sr * 2);
    bufNoise = ctx.createBuffer(1, nLen, sr);
    const nd = bufNoise.getChannelData(0);
    for (let i = 0; i < nLen; i++) nd[i] = Math.random() * 2 - 1;

    const tLen = Math.floor(sr * 0.006);
    bufTick = ctx.createBuffer(1, tLen, sr);
    const td = bufTick.getChannelData(0);
    for (let i = 0; i < tLen; i++)
      td[i] = (Math.random() * 2 - 1) * Math.exp(-i / (tLen * 0.06));

    const iLen = Math.floor(sr * 0.05);
    bufImpact = ctx.createBuffer(1, iLen, sr);
    const id = bufImpact.getChannelData(0);
    for (let i = 0; i < iLen; i++)
      id[i] = (Math.random() * 2 - 1) * Math.exp(-i / (iLen * 0.12));

    const gLen = Math.floor(sr * 0.09);
    bufGlitch = [];
    for (let v = 0; v < 3; v++) {
      const b = ctx.createBuffer(1, gLen, sr);
      const d = b.getChannelData(0);
      let hold = 0;
      for (let i = 0; i < gLen; i++) {
        if (i % (5 + v * 2) === 0) hold = Math.random() * 2 - 1; // bit-crush
        d[i] = hold * (1 - i / gLen);
      }
      bufGlitch.push(b);
    }
  }

  function init() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!window.audioCtx) window.audioCtx = new Ctx();
      ctx = window.audioCtx; // contesto condiviso col resto del sito

      // ✨ UNLOCK iOS: buffer muto da 1 sample che forza Safari a
      // svegliare l'hardware audio dentro lo user-gesture corrente.
      // Idempotente: sicuro anche a init() ripetuti.
      const unlock = ctx.createBufferSource();
      unlock.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      unlock.connect(ctx.destination);
      unlock.start(0);
      if (ctx.state !== 'running') ctx.resume().catch(() => {});

      // Catena già costruita da un mount precedente: la riuso.
      if (ctx.__ghostChain) {
        const c = ctx.__ghostChain;
        bus = c.bus; limiter = c.limiter; master = c.master;
        bufNoise = c.bufNoise; bufTick = c.bufTick;
        bufImpact = c.bufImpact; bufGlitch = c.bufGlitch;
        return;
      }

      bus = ctx.createGain();
      bus.gain.value = 1.0;

      const glue = ctx.createWaveShaper();
      glue.curve = SAT_GLUE;
      glue.oversample = '4x';

      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1.5;
      limiter.knee.value      = 0;
      limiter.ratio.value     = 20;
      limiter.attack.value    = 0.002;
      limiter.release.value   = 0.12;

      master = ctx.createGain();
      master.gain.value = 0.92;

      bus.connect(glue);
      glue.connect(limiter);
      limiter.connect(master);
      master.connect(ctx.destination);

      buildBuffers();

      ctx.__ghostChain = { bus, limiter, master, bufNoise, bufTick, bufImpact, bufGlitch };
    } catch {
      ctx = null; bus = null; limiter = null; master = null;
    }
  }

  /* Sospensione/ripresa legate alla visibilità della tab: l'audio si
     congela insieme alla show-clock, quindi al ritorno non c'è deriva
     tra ciò che si sente e ciò che si vede (e la batteria ringrazia). */
  function suspend() {
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  }
  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  /* ── AMBIENCE — il respiro del monitor CRT ─────────────────────
     3 strati permanenti, tutti quietissimi:
       · hum elettrico 50Hz + armonica 100Hz (rete elettrica europea)
       · flyback whine 15.7kHz appena percepibile (firma del CRT)
       · letto di rumore filtrato con tremolo lentissimo (aria/statica)
     setIntensity() apre il filtro e alza il letto: l'ambiente EVOLVE
     con la sequenza invece di restare piatto e diventare fastidioso. */
  function startAmbience() {
    if (!ok() || amb) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = bufNoise;
    src.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;
    lp.Q.value = 0.7;

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0001, now);
    nGain.gain.exponentialRampToValueAtTime(0.030, now + 1.6);

    // Tremolo lentissimo: l'aria "respira", non è rumore statico
    const trem  = ctx.createOscillator();
    const tremG = ctx.createGain();
    trem.type = 'sine';
    trem.frequency.value = 0.09;
    tremG.gain.value = 0.010;
    trem.connect(tremG);
    tremG.connect(nGain.gain);
    trem.start(now);

    src.connect(hp); hp.connect(lp); lp.connect(nGain); nGain.connect(bus);
    src.start(now);

    const hum1  = ctx.createOscillator();
    const hum1G = ctx.createGain();
    hum1.type = 'sine'; hum1.frequency.value = 50;
    hum1G.gain.setValueAtTime(0.0001, now);
    hum1G.gain.exponentialRampToValueAtTime(0.052, now + 1.2);
    hum1.connect(hum1G); hum1G.connect(bus); hum1.start(now);

    const hum2  = ctx.createOscillator();
    const hum2G = ctx.createGain();
    hum2.type = 'sine'; hum2.frequency.value = 100;
    hum2G.gain.setValueAtTime(0.0001, now);
    hum2G.gain.exponentialRampToValueAtTime(0.020, now + 1.2);
    hum2.connect(hum2G); hum2G.connect(bus); hum2.start(now);

    const fly  = ctx.createOscillator();
    const flyG = ctx.createGain();
    fly.type = 'sine'; fly.frequency.value = 15700;
    flyG.gain.setValueAtTime(0.0001, now);
    flyG.gain.exponentialRampToValueAtTime(0.0024, now + 2.0);
    fly.connect(flyG); flyG.connect(bus); fly.start(now);

    amb = { src, lp, nGain, trem, oscs: [hum1, hum2, fly], gains: [hum1G, hum2G, flyG] };
  }

  function setIntensity(v) {
    if (!ok() || !amb) return;
    const now = ctx.currentTime;
    const k = clamp01(v);
    amb.lp.frequency.cancelScheduledValues(now);
    amb.lp.frequency.linearRampToValueAtTime(2600 + k * 6200, now + 0.35);
    amb.nGain.gain.cancelScheduledValues(now);
    amb.nGain.gain.linearRampToValueAtTime(0.028 + k * 0.030, now + 0.35);
  }

  function stopAmbience(fade = 0.8) {
    if (!ctx || !amb) return;
    const now = ctx.currentTime;
    const stopAt = now + fade + 0.08;
    const a = amb;
    amb = null; // subito, così una seconda chiamata non ri-schedula

    a.nGain.gain.cancelScheduledValues(now);
    a.nGain.gain.setValueAtTime(Math.max(a.nGain.gain.value, 0.0001), now);
    a.nGain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    a.gains.forEach(g => {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    });
    try { a.src.stop(stopAt); }  catch { /* già fermato */ }
    try { a.trem.stop(stopAt); } catch { /* già fermato */ }
    a.oscs.forEach(o => { try { o.stop(stopAt); } catch { /* già fermato */ } });
  }

  /* ── DRONE — sub-bass stereo detunato: la minaccia sotto la scena ──
     Due voci identiche a ±8 cent pannate L/R (larghezza stereo e
     beating organico), fondamentale D1 con sub-ottava D0 sotto.
     Un lowpass risonante respira via LFO a 0.06Hz. */
  function startDrone() {
    if (!ok() || drone) return;
    const now = ctx.currentTime;

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 130;
    filt.Q.value = 1.4;

    const lfo     = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06;
    lfoGain.gain.value  = 70;
    lfo.connect(lfoGain);
    lfoGain.connect(filt.frequency);
    lfo.start(now);

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0.0001, now);
    droneGain.gain.exponentialRampToValueAtTime(0.60, now + 2.2);

    filt.connect(droneGain);
    droneGain.connect(bus);

    const partials = [
      { f: 18.35, type: 'sine',     v: 0.30 }, // sub-ottava (D0)
      { f: 36.70, type: 'sine',     v: 0.55 }, // fondamentale (D1)
      { f: 55.10, type: 'sine',     v: 0.30 }, // quinta
      { f: 73.40, type: 'triangle', v: 0.12 }, // ottava, un filo di grana
    ];
    const voices = [
      { detune: -8, pan: -0.55 },
      { detune:  8, pan:  0.55 },
    ];

    const oscs = [];
    const canPan = typeof ctx.createStereoPanner === 'function';
    voices.forEach(({ detune, pan }) => {
      const vGain = ctx.createGain();
      vGain.gain.value = 0.5;
      if (canPan) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        vGain.connect(panner);
        panner.connect(filt);
      } else {
        vGain.connect(filt); // fallback mono (vecchi WebView)
      }
      partials.forEach(({ f, type, v }) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = type;
        osc.frequency.value = f;
        osc.detune.value = detune;
        g.gain.value = v;
        osc.connect(g);
        g.connect(vGain);
        osc.start(now);
        oscs.push(osc);
      });
    });

    drone = { gain: droneGain, oscs, lfo };
  }

  function stopDrone(fade = 1.0) {
    if (!ctx || !drone) return;
    const now = ctx.currentTime;
    const d = drone;
    drone = null; // subito: stopDrone è idempotente

    d.gain.gain.cancelScheduledValues(now);
    d.gain.gain.setValueAtTime(Math.max(d.gain.gain.value, 0.0001), now);
    d.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    const stopAt = now + fade + 0.1;
    d.oscs.forEach(o => { try { o.stop(stopAt); } catch { /* già fermato */ } });
    try { d.lfo.stop(stopAt); } catch { /* già fermato */ }
  }

  /* ── BOOT — accensione: whoosh filtrato + accordo grave che sale ── */
  function boot() {
    if (!ok()) return;
    const now = ctx.currentTime + LOOK;

    const src = ctx.createBufferSource();
    src.buffer = bufNoise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(120, now);
    bp.frequency.exponentialRampToValueAtTime(2400, now + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.20, now + 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    src.connect(bp); bp.connect(g); g.connect(bus);
    src.start(now); src.stop(now + 1.6);

    [55.0, 82.41, 110.0].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const og  = ctx.createGain();
      const t0  = now + i * 0.09;
      osc.type = i === 2 ? 'triangle' : 'sine';
      osc.frequency.value = f;
      og.gain.setValueAtTime(0.0001, t0);
      og.gain.exponentialRampToValueAtTime(0.16 - i * 0.035, t0 + 0.7);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
      osc.connect(og); og.connect(bus);
      osc.start(t0); osc.stop(t0 + 2.5);
    });
  }

  /* ── TICK — click aptico secco e digitale (tastiera del terminale) ──
     Buffer pre-generato, variazione affidata alla frequenza casuale di
     un bandpass stretto: mai due tick identici, zero allocazioni. */
  function tick(vol = 0.22) {
    if (!ok()) return;
    const now = ctx.currentTime + LOOK;
    const src = ctx.createBufferSource();
    const bp  = ctx.createBiquadFilter();
    const g   = ctx.createGain();
    src.buffer = bufTick;
    bp.type = 'bandpass';
    bp.frequency.value = 2600 + Math.random() * 1800;
    bp.Q.value = 2.2;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    src.connect(bp); bp.connect(g); g.connect(bus);
    src.start(now); src.stop(now + 0.05);
  }

  /* ── BEEP — micro-pulsazione sintetica, sonar di sistema ── */
  function beep(freq = 1480, vol = 0.055, dur = 0.09) {
    if (!ok()) return;
    const now = ctx.currentTime + LOOK;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.86, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g); g.connect(bus);
    osc.start(now); osc.stop(now + dur + 0.02);
  }

  /* ── GLITCH — interferenza digitale: 1 delle 3 varianti crushate,
     bandpass a frequenza e direzione casuali ── */
  function glitch(vol = 0.13) {
    if (!ok()) return;
    const now = ctx.currentTime + LOOK;
    const src = ctx.createBufferSource();
    const ws  = ctx.createWaveShaper();
    const bp  = ctx.createBiquadFilter();
    const g   = ctx.createGain();
    src.buffer = bufGlitch[(Math.random() * bufGlitch.length) | 0];
    ws.curve = SAT_CRUSH;
    ws.oversample = '2x';
    bp.type = 'bandpass';
    bp.Q.value = 1.6;
    const f0 = 700 + Math.random() * 2600;
    bp.frequency.setValueAtTime(f0, now);
    bp.frequency.exponentialRampToValueAtTime(f0 * (0.4 + Math.random()), now + 0.09);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    src.connect(ws); ws.connect(bp); bp.connect(g); g.connect(bus);
    src.start(now); src.stop(now + 0.13);
  }

  /* ── DATA BURST — trasmissione dati: raffica di micro-impulsi ── */
  function dataBurst(count = 14, spread = 0.5) {
    if (!ok()) return;
    const now = ctx.currentTime + LOOK;
    for (let i = 0; i < count; i++) {
      const t0  = now + Math.random() * spread;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = Math.random() > 0.5 ? 'square' : 'sine';
      osc.frequency.value = 1600 + Math.random() * 3400;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.018 + Math.random() * 0.016, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.018);
      osc.connect(g); g.connect(bus);
      osc.start(t0); osc.stop(t0 + 0.03);
    }
  }

  /* ── SWEEP — riser: la tensione che precede la genesi del logo ── */
  function sweep(dur = 1.8) {
    if (!ok()) return;
    const now = ctx.currentTime + LOOK;

    const src = ctx.createBufferSource();
    src.buffer = bufNoise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3.4;
    bp.frequency.setValueAtTime(220, now);
    bp.frequency.exponentialRampToValueAtTime(7600, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + dur * 0.86);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.16);
    src.connect(bp); bp.connect(g); g.connect(bus);
    src.start(now); src.stop(now + dur + 0.2);

    const osc = ctx.createOscillator();
    const og  = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + dur);
    og.gain.setValueAtTime(0.0001, now);
    og.gain.exponentialRampToValueAtTime(0.075, now + dur * 0.9);
    og.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.14);
    osc.connect(og); og.connect(bus);
    osc.start(now); osc.stop(now + dur + 0.2);
  }

  /* ── BRAAM — l'impatto. 4 strati:
       1 IMPACT  transiente lowpassato: la botta iniziale.
       2 SUB     sine 62→28Hz in caduta: colpo allo sterno.
       3 BODY    sawtooth detunati dentro un WaveShaper caldo e un
                 lowpass che si chiude 700→60Hz: l'ottone saturato.
       4 SHIMMER quinte/ottave alte, quietissime, per lo scintillio.
     Tutto sul bus caldo: il brickwall tiene i picchi a 0dBFS, quindi
     è esplosivo ma non sgradevole nemmeno sugli speaker del telefono. */
  function braam() {
    if (!ok()) return;
    const now = ctx.currentTime + LOOK;

    const braamBus = ctx.createGain();
    braamBus.gain.value = 1.0;
    braamBus.connect(bus);

    const imp   = ctx.createBufferSource();
    const impLp = ctx.createBiquadFilter();
    const impG  = ctx.createGain();
    imp.buffer = bufImpact;
    impLp.type = 'lowpass';
    impLp.frequency.value = 1800;
    impG.gain.value = 0.6;
    imp.connect(impLp); impLp.connect(impG); impG.connect(braamBus);
    imp.start(now); imp.stop(now + 0.06);

    const boom  = ctx.createOscillator();
    const boomG = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(62, now);
    boom.frequency.exponentialRampToValueAtTime(28, now + 0.9);
    boomG.gain.setValueAtTime(0.0001, now);
    boomG.gain.exponentialRampToValueAtTime(0.95, now + 0.04);
    boomG.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
    boom.connect(boomG); boomG.connect(braamBus);
    boom.start(now); boom.stop(now + 2.7);

    const drive = ctx.createGain();
    drive.gain.value = 2.2;
    const shaper = ctx.createWaveShaper();
    shaper.curve = SAT_WARM;
    shaper.oversample = '4x';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, now);
    lp.frequency.exponentialRampToValueAtTime(60, now + 3.0);
    lp.Q.value = 1.1;
    const bodyG = ctx.createGain();
    bodyG.gain.setValueAtTime(0.0001, now);
    bodyG.gain.exponentialRampToValueAtTime(0.9, now + 0.07);
    bodyG.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
    drive.connect(shaper); shaper.connect(lp); lp.connect(bodyG); bodyG.connect(braamBus);

    [
      { f: 41.20, type: 'sawtooth', v: 0.55, detune: -7 },
      { f: 41.20, type: 'sawtooth', v: 0.55, detune:  7 },
      { f: 61.74, type: 'sawtooth', v: 0.32, detune:  0 },
      { f: 82.40, type: 'triangle', v: 0.20, detune:  0 },
    ].forEach(({ f, type, v, detune }) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = type;
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.94, now + 3.2);
      g.gain.value = v;
      osc.connect(g); g.connect(drive);
      osc.start(now); osc.stop(now + 3.5);
    });

    [329.63, 392.00, 493.88].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      const t0  = now + 0.12 + i * 0.07;
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
      osc.connect(g); g.connect(braamBus);
      osc.start(t0); osc.stop(t0 + 2.4);
    });
  }

  /* ── SHATTER — la dissoluzione finale, NON un secondo impatto.
     Il braam è il climax e va speso una volta sola: sul logo che si
     compone. Qui il gesto è opposto — la materia si disperde — quindi
     il suono è speculare: trasiente cristallino in alto invece che
     botta in basso, filtro che si APRE verso l'acuto e poi svanisce,
     e un sub breve e morbido che accompagna l'uscita nell'Hero senza
     ricolpire allo sterno.
       1 SHARD    burst brevissimo in alta frequenza: il vetro che cede.
       2 DISPERSE rumore con bandpass che scende 6k→400Hz mentre sfuma:
                  la nuvola di particelle che si allontana.
       3 UNDER    sub 45→22Hz a volume contenuto: peso, non impatto.
       4 TAIL     armoniche alte che si detunano e si spengono. */
  function shatter() {
    if (!ok()) return;
    const now = ctx.currentTime + LOOK;

    // 1 · SHARD — cristallino, quasi istantaneo
    const sh  = ctx.createBufferSource();
    const shHp = ctx.createBiquadFilter();
    const shG = ctx.createGain();
    sh.buffer = bufTick;
    sh.playbackRate.value = 0.55; // allunga leggermente il grano
    shHp.type = 'highpass';
    shHp.frequency.value = 3800;
    shG.gain.setValueAtTime(0.34, now);
    shG.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    sh.connect(shHp); shHp.connect(shG); shG.connect(bus);
    sh.start(now); sh.stop(now + 0.2);

    // 2 · DISPERSE — la nuvola che si allontana
    const dis = ctx.createBufferSource();
    const dbp = ctx.createBiquadFilter();
    const dG  = ctx.createGain();
    dis.buffer = bufNoise;
    dis.loop = true;
    dbp.type = 'bandpass';
    dbp.Q.value = 1.1;
    dbp.frequency.setValueAtTime(6000, now);
    dbp.frequency.exponentialRampToValueAtTime(400, now + 1.25);
    dG.gain.setValueAtTime(0.0001, now);
    dG.gain.exponentialRampToValueAtTime(0.26, now + 0.05);
    dG.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    dis.connect(dbp); dbp.connect(dG); dG.connect(bus);
    dis.start(now); dis.stop(now + 1.6);

    // 3 · UNDER — peso, non impatto (metà del sub del braam)
    const sub  = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(45, now);
    sub.frequency.exponentialRampToValueAtTime(22, now + 1.1);
    subG.gain.setValueAtTime(0.0001, now);
    subG.gain.exponentialRampToValueAtTime(0.42, now + 0.06);
    subG.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    sub.connect(subG); subG.connect(bus);
    sub.start(now); sub.stop(now + 1.9);

    // 4 · TAIL — armoniche che si sfilacciano verso l'alto
    [659.25, 987.77, 1318.51].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      const t0  = now + i * 0.045;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      osc.frequency.exponentialRampToValueAtTime(f * 1.06, t0 + 1.1); // sale e sfuma
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.034 - i * 0.008, t0 + 0.09);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
      osc.connect(g); g.connect(bus);
      osc.start(t0); osc.stop(t0 + 1.3);
    });
  }

  function destroy() {
    try { stopDrone(0.05); }    catch { /* già spento */ }
    try { stopAmbience(0.05); } catch { /* già spento */ }
    // NON chiudiamo ctx né la catena: window.audioCtx resta vivo per il
    // resto del sito e la coda del braam continua dentro l'Hero.
    bus = null; limiter = null; master = null; drone = null; amb = null;
  }

  return {
    init, suspend, resume, startAmbience, stopAmbience, setIntensity,
    startDrone, stopDrone, boot, tick, beep, glitch, dataBurst, sweep,
    braam, shatter, destroy, ok,
  };
}


/* ═══════════════════════════════════════════════════════════════
   TERMINAL — sequenza di boot
═══════════════════════════════════════════════════════════════ */
const BOOT_LINES = [
  { text: 'initializing visual engine',     code: '0x1A2F', accent: false },
  { text: 'loading shaders / gpu pipeline', code: '0x4C09', accent: false },
  { text: 'decrypting interface layer',     code: '0x77B1', accent: false },
  { text: 'establishing neural connection', code: '0x02E8', accent: false },
  { text: 'authenticating visitor',         code: '0xBD34', accent: false },
  { text: 'integrity check — 12 nodes',     code: '0x5F60', accent: false },
  { text: 'ACCESS GRANTED',                 code: '——',     accent: true  },
];


/* ═══════════════════════════════════════════════════════════════
   TYPE LINE — typing realistico con micro-glitch sulla testina
   ───────────────────────────────────────────────────────────────
   Guidato da rAF, non da setInterval. Un interval a 11ms su un
   display a 60Hz produce due scritture per frame (una non viene mai
   dipinta) e un ritmo irregolare; con rAF ogni carattere corrisponde
   a un fotogramma reale e il tick audio parte nello stesso frame in
   cui il carattere appare.
═══════════════════════════════════════════════════════════════ */
const CHARS_PER_SEC = 78;

const TypeLine = memo(({ text, code, accent, onKey }) => {
  const ref     = useRef(null);
  const codeRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = String(text);
    let shown = 0;      // caratteri già stabili
    let acc = 0;        // accumulatore frazionario
    let prev = 0;
    let raf = 0;
    let lastPaint = -1; // evita scritture DOM ridondanti

    const step = (ts) => {
      if (!prev) prev = ts;
      const dt = Math.min((ts - prev) / 1000, 0.1);
      prev = ts;
      acc += dt * CHARS_PER_SEC;

      while (acc >= 1 && shown < s.length) {
        acc -= 1;
        shown++;
        if (shown % 3 === 0) onKey?.();
      }

      if (shown >= s.length) {
        if (lastPaint !== s.length) el.textContent = s;
        if (codeRef.current) codeRef.current.style.opacity = '1';
        return; // nessun rAF ulteriore: la riga è finita
      }

      // La testina sputa un carattere sporco prima di stabilizzarsi:
      // è ciò che rende il typing meccanico invece che perfetto.
      const head = Math.random() < 0.2
        ? GLITCH_CH[(Math.random() * GLITCH_CH.length) | 0]
        : '';
      el.textContent = s.slice(0, shown) + head;
      lastPaint = shown;
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, onKey]);

  return (
    <div className="term-line" style={{
      display: 'flex', alignItems: 'baseline', gap: '0.9rem',
      color: accent ? T.emerald : T.boneDim,
      textShadow: accent ? '0 0 18px rgba(43,224,140,0.45)' : 'none',
    }}>
      <span style={{ color: accent ? T.emerald : T.boneGhost, flexShrink: 0 }}>
        {accent ? '»' : '>'}
      </span>
      <span
        ref={ref}
        style={{
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          minWidth: 0, flex: '1 1 auto',
          letterSpacing: accent ? '0.34em' : '0.14em',
          textTransform: accent ? 'uppercase' : 'none',
        }}
      />
      <span
        ref={codeRef}
        className="term-code"
        style={{
          color: T.boneGhost, flexShrink: 0, opacity: 0,
          transition: 'opacity 500ms cubic-bezier(0.32,0.72,0,1)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {code}
      </span>
    </div>
  );
});
TypeLine.displayName = 'TypeLine';


/* ═══════════════════════════════════════════════════════════════
   GATE SCREEN — sblocco AudioContext al primissimo gesto
   ───────────────────────────────────────────────────────────────
   L'engine è creato EAGER dal Preloader, quindi init()/startAmbience()
   girano DENTRO lo user-gesture reale (pointerdown/touchstart/click):
   l'unico punto in cui Safari iOS autorizza il risveglio dell'audio.
═══════════════════════════════════════════════════════════════ */
function GateScreen({ onEnter, audioRef }) {
  const gateRef = useRef(null);
  const textRef = useRef(null);
  const entered = useRef(false);

  useEffect(() => {
    const tween = gsap.fromTo(
      textRef.current,
      { opacity: 0, y: 18, filter: 'blur(6px)' },
      {
        opacity: 1, y: 0, filter: 'blur(0px)',
        duration: 1.5, ease: 'expo.out', delay: 0.3, force3D: true,
      }
    );
    return () => tween.kill();
  }, []);

  // Unlock il più precoce possibile: già su pointerdown/touchstart.
  const initAudio = useCallback(() => {
    audioRef.current?.init?.();
  }, [audioRef]);

  const enter = useCallback(() => {
    if (entered.current) return;
    entered.current = true;
    initAudio();
    // Ambience + boot avviati DENTRO il gesture: aggira i blocchi iOS.
    audioRef.current?.startAmbience?.();
    audioRef.current?.boot?.();

    gsap.to(gateRef.current, {
      opacity: 0,
      duration: 0.55,
      ease: 'power2.inOut',
      force3D: true,
      onComplete: onEnter,
    });
  }, [initAudio, onEnter]);

  return (
    <div
      ref={gateRef}
      onPointerDown={initAudio}
      onTouchStart={initAudio}
      onClick={enter}
      style={{
        position: 'absolute', inset: 0, zIndex: 30,
        background: T.void,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', userSelect: 'none',
        willChange: 'opacity',
      }}
    >
      {/* Registri d'angolo — riferimenti da blueprint */}
      {[
        { top: '1.7rem', left: '1.7rem' }, { top: '1.7rem', right: '1.7rem' },
        { bottom: '1.7rem', left: '1.7rem' }, { bottom: '1.7rem', right: '1.7rem' },
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
          gap: '1.7rem', opacity: 0, textAlign: 'center',
          padding: `0 ${PX}`, width: '100%', boxSizing: 'border-box',
        }}
      >
        <div style={{
          fontFamily: MONO, fontSize: 'clamp(0.5rem, 1vw, 0.62rem)',
          color: T.boneDim, letterSpacing: '0.3em', textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
        }}>
          SEBASTIANO MOLLO — CREATIVE DEVELOPER
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.62rem',
          color: T.emerald, opacity: 0.86, marginBottom: '-0.5rem',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.25"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
          <span style={{
            fontFamily: MONO, fontSize: 'clamp(0.48rem, 1vw, 0.58rem)',
            letterSpacing: '0.22em', textTransform: 'uppercase',
          }}>
            L&apos;audio arricchisce l&apos;esperienza
          </span>
        </div>

        {/* CTA — pill nested, alone morbido, nessun neon da bancarella */}
        <button
          type="button"
          className="gate-cta"
          aria-label="Entra nell'esperienza: attiva l'audio e avvia la sequenza"
          style={{
            position: 'relative',
            display: 'inline-flex', alignItems: 'center', gap: '1.1rem',
            padding: '0.95rem 0.95rem 0.95rem 1.9rem',
            borderRadius: '999px',
            background: 'rgba(232,233,230,0.035)',
            border: '1px solid rgba(232,233,230,0.10)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.10), 0 24px 70px -30px rgba(43,224,140,0.55)',
            color: T.bone, fontFamily: MONO, cursor: 'pointer',
            fontSize: 'clamp(0.66rem, 1.5vw, 0.82rem)',
            letterSpacing: '0.34em', textTransform: 'uppercase',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span>Enter</span>
          {/* Button-in-button: l'icona vive nel suo cerchio, mai nuda */}
          <span className="gate-orb" aria-hidden style={{
            width: '2rem', height: '2rem', borderRadius: '999px',
            background: 'rgba(43,224,140,0.12)',
            border: '1px solid rgba(43,224,140,0.22)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: T.emerald, flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.4"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7" /><path d="M9 7h8v8" />
            </svg>
          </span>
        </button>

        <div style={{
          fontFamily: MONO, fontSize: 'clamp(0.46rem, 0.9vw, 0.56rem)',
          color: T.boneGhost, letterSpacing: '0.24em', textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
        }}>
          Click to initialize — encrypted audio / visual handshake
        </div>
      </div>

      <style>{`
        .gate-cta {
          transition: transform 700ms cubic-bezier(0.32,0.72,0,1),
                      background-color 700ms cubic-bezier(0.32,0.72,0,1),
                      box-shadow 700ms cubic-bezier(0.32,0.72,0,1),
                      border-color 700ms cubic-bezier(0.32,0.72,0,1);
          will-change: transform;
        }
        .gate-cta:hover {
          background-color: rgba(232,233,230,0.07);
          border-color: rgba(43,224,140,0.30);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.14),
                      0 30px 90px -30px rgba(43,224,140,0.75);
        }
        .gate-cta:active { transform: scale(0.978); }
        .gate-cta:focus-visible { outline: 1px solid rgba(43,224,140,0.55); outline-offset: 4px; }
        .gate-orb {
          transition: transform 700ms cubic-bezier(0.32,0.72,0,1),
                      background-color 700ms cubic-bezier(0.32,0.72,0,1);
          will-change: transform;
        }
        .gate-cta:hover .gate-orb {
          transform: translate3d(3px,-1px,0) scale(1.06);
          background-color: rgba(43,224,140,0.20);
        }
        /* Alone sinusoidale lento — premium, niente blink step-end */
        .gate-cta::after {
          content: '';
          position: absolute; inset: -1px;
          border-radius: 999px;
          box-shadow: 0 0 0 1px rgba(43,224,140,0.16);
          opacity: 0;
          animation: gateHalo 3.2s cubic-bezier(0.45,0,0.55,1) infinite;
          pointer-events: none;
        }
        @keyframes gateHalo { 0%,100% { opacity: 0.15 } 50% { opacity: 0.75 } }
        @media (prefers-reduced-motion: reduce) {
          .gate-cta::after { animation: none; opacity: 0.3; }
          .gate-cta, .gate-orb { transition: none; }
        }
      `}</style>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   ATLANTE DEI GLIFI
   ───────────────────────────────────────────────────────────────
   Renderizza UNA volta ogni glifo in due varianti cromatiche
   (corpo emerald / testa pallida) su un canvas offscreen.
   Nel loop si usa drawImage: niente shaping del testo per frame,
   niente cambi di fillStyle, e la variazione di scala per colonna
   è gratuita (parametri di destinazione della drawImage).
   Le coordinate SORGENTE sono pre-moltiplicate per il DPR: due
   moltiplicazioni in meno per ogni glifo di ogni frame.
═══════════════════════════════════════════════════════════════ */
function buildGlyphAtlas(fontPx, dpr) {
  const pad = 3;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `500 ${fontPx}px ${MONO}`;

  const widths = new Float32Array(TOTAL_N);
  let total = 0;
  for (let i = 0; i < TOTAL_N; i++) {
    const w = Math.ceil(meas.measureText(GLYPHS[i]).width) + pad * 2;
    widths[i] = w;
    total += w;
  }

  const cellH = Math.ceil(fontPx * 1.34);
  const colors = [T.emerald, T.pale]; // riga 0 = corpo, riga 1 = testa

  const cv = document.createElement('canvas');
  cv.width  = Math.max(1, Math.ceil(total * dpr));
  cv.height = Math.max(1, Math.ceil(cellH * colors.length * dpr));
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  c.font = `500 ${fontPx}px ${MONO}`;
  c.textBaseline = 'middle';
  c.textAlign = 'left';

  const xs = new Float32Array(TOTAL_N);
  for (let r = 0; r < colors.length; r++) {
    c.fillStyle = colors[r];
    let x = 0;
    for (let i = 0; i < TOTAL_N; i++) {
      if (r === 0) xs[i] = x;
      c.fillText(GLYPHS[i], x + pad, r * cellH + cellH / 2);
      x += widths[i];
    }
  }

  // Coordinate sorgente già in pixel-device
  const xsD = new Float32Array(TOTAL_N);
  const wD  = new Float32Array(TOTAL_N);
  for (let i = 0; i < TOTAL_N; i++) { xsD[i] = xs[i] * dpr; wD[i] = widths[i] * dpr; }

  return { cv, xs, widths, xsD, wD, cellH, cellHD: cellH * dpr };
}


/* ═══════════════════════════════════════════════════════════════
   CAMPIONAMENTO DEL LOGO
   ───────────────────────────────────────────────────────────────
   Disegna SEBAMOX su un canvas offscreen delle sole dimensioni del
   testo, campiona la maschera alpha con passo ADATTIVO e restituisce
   i punti in coordinate schermo. Fisher-Yates sugli indici così le
   particelle si distribuiscono su TUTTA la parola: senza shuffle le
   prime lettere si formerebbero prima delle ultime.
═══════════════════════════════════════════════════════════════ */
function sampleLogoPoints(W, H, stride, maxPoints, cy) {
  const fs = Math.max(34, Math.min(W * 0.145, H * 0.19));
  const track = fs * 0.055;

  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `900 ${fs}px ${DISPLAY}`;

  const chars = LOGO_TEXT.split('');
  const cw = new Float32Array(chars.length);
  let totalW = 0;
  for (let i = 0; i < chars.length; i++) {
    cw[i] = meas.measureText(chars[i]).width;
    totalW += cw[i] + track;
  }
  totalW -= track;

  // Se la parola sfora il viewport, riscala tutto proporzionalmente
  const maxW   = W * 0.86;
  const fit    = totalW > maxW ? maxW / totalW : 1;
  const fsF    = fs * fit;
  const trackF = track * fit;
  const totalF = totalW * fit;

  const padY = fsF * 0.42;
  const cw2  = Math.max(2, Math.ceil(totalF) + 8);
  const ch2  = Math.max(2, Math.ceil(fsF + padY * 2));

  const off = document.createElement('canvas');
  off.width  = cw2;
  off.height = ch2;
  const oc = off.getContext('2d', { willReadFrequently: true });
  oc.font = `900 ${fsF}px ${DISPLAY}`;
  oc.textBaseline = 'middle';
  oc.textAlign = 'left';
  oc.fillStyle = '#fff';

  let x = 4;
  const baseline = ch2 / 2;
  for (let i = 0; i < chars.length; i++) {
    oc.fillText(chars[i], x, baseline);
    x += cw[i] * fit + trackF;
  }

  let data;
  try {
    data = oc.getImageData(0, 0, cw2, ch2).data;
  } catch {
    // Canvas "tainted": non può accadere (nessuna immagine esterna),
    // ma se accadesse restituiamo zero punti invece di far crashare.
    return { pts: new Float32Array(0), count: 0, fontSize: fsF };
  }

  const originX = (W - totalF) / 2 - 4;
  const originY = cy - ch2 / 2;

  /* Campionamento a passo ADATTIVO.
     Uno stride fisso produce un logo denso su desktop e sgranato su
     mobile (la parola rimpicciolisce, il passo no). Qui si parte dal
     passo del tier e lo si stringe finché la densità non è degna: il
     numero di particelle resta vicino al tetto del tier a QUALSIASI
     viewport, quindi la parola è sempre piena e leggibile. */
  const collect = (st) => {
    const out = [];
    for (let py = 0; py < ch2; py += st) {
      for (let px = 0; px < cw2; px += st) {
        if (data[(py * cw2 + px) * 4 + 3] > 128) {
          out.push(originX + px, originY + py);
        }
      }
    }
    return out;
  };

  let st = Math.max(1, stride);
  let raw = collect(st);
  while (raw.length / 2 < maxPoints * 0.62 && st > 1) {
    st -= 1;
    raw = collect(st);
  }

  const n = raw.length / 2;
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }

  const count = Math.min(n, maxPoints);
  const pts = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    pts[i * 2]     = raw[idx[i] * 2];
    pts[i * 2 + 1] = raw[idx[i] * 2 + 1];
  }

  return { pts, count, fontSize: fsF };
}


/* ═══════════════════════════════════════════════════════════════
   GHOST SCENE — l'intero spettacolo su UN canvas 2D
   ───────────────────────────────────────────────────────────────
   props (tutti ref → ZERO re-render di React durante l'animazione):
   - clockRef   : { t } show-clock condivisa, avanzata QUI
   - onFrameRef : { current } callback chiamata ogni frame con la
                  show-clock: è il cuore della sincronia audio/video
   - modeRef    : { mode, t0, dur } macchina a fasi (t0 in show-clock)
   - pointerRef : { x, y, tx, ty, s, ts } campo magnetico del cursore
   - flareRef   : { current } flash dell'exit
   - reduced    : prefers-reduced-motion
═══════════════════════════════════════════════════════════════ */
const GhostScene = memo(({ clockRef, onFrameRef, modeRef, pointerRef, flareRef, reduced }) => {
  const cvRef = useRef(null);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    // alpha:true è necessario per l'uscita seamless: nell'ultima fase
    // il fondo si dissolve e l'Hero del sito traspare DIETRO le
    // particelle ancora in volo.
    const g = cv.getContext('2d', { alpha: true });

    /* ── Quality Governor ─────────────────────────────────────── */
    const isMobile = window.innerWidth < 768;
    let tierIdx = isMobile ? 1 : 0; // mobile parte già conservativo
    let tier = QUALITY_TIERS[tierIdx];
    let frameAcc = 0, frameCount = 0;

    /* ── Dimensioni (nessuna lettura DOM nel loop) ────────────── */
    let W = 0, H = 0, dpr = 1, dprInv = 1;
    let logoCy = 0;
    let fieldR = 230, fieldR2 = 230 * 230;

    /* ── Atlante glifi ────────────────────────────────────────── */
    let atlas = null;

    /* ── Colonne della pioggia (typed arrays, riallocati solo su
          resize o degrado di tier) ────────────────────────────── */
    let cols = 0;
    let colY = null;     // posizione testa (px)
    let colV = null;     // velocità (px/s)
    let colA = null;     // accelerazione (px/s²)
    let colLen = null;   // lunghezza scia (glifi)
    let colSc = null;    // scala tipografica
    let colAl = null;    // alpha di colonna
    let colWait = null;  // secondi di dormienza prima del restart
    let colBuf = null;   // Uint8Array cols*MAX_TRAIL → id dei glifi
    let MAX_TRAIL = 26;

    /* ── Snapshot delle posizioni dei glifi: è la SORGENTE delle
          particelle nel momento della genesi ──────────────────── */
    const MAX_SNAP = 4000;
    const snap = new Float32Array(MAX_SNAP * 2);
    let snapN = 0;

    /* ── Particelle ───────────────────────────────────────────── */
    const MAX_P = QUALITY_TIERS[0].particles;
    const pSX = new Float32Array(MAX_P);  // start x
    const pSY = new Float32Array(MAX_P);  // start y
    const pTX = new Float32Array(MAX_P);  // target x
    const pTY = new Float32Array(MAX_P);  // target y
    const pDL = new Float32Array(MAX_P);  // delay normalizzato
    const pSW = new Float32Array(MAX_P);  // swirl (rad)
    const pPh = new Float32Array(MAX_P);  // fase del respiro
    const pVX = new Float32Array(MAX_P);  // velocità d'esplosione x
    const pVY = new Float32Array(MAX_P);  // velocità d'esplosione y
    const pSz = new Float32Array(MAX_P);  // dimensione
    // Scratch per il batching: posizione/dimensione calcolate una
    // volta, poi disegnate raggruppate per livello di alpha.
    const sX = new Float32Array(MAX_P);
    const sY = new Float32Array(MAX_P);
    const sS = new Float32Array(MAX_P);
    const sL = new Uint8Array(MAX_P);     // livello corpo (255 = scartata)
    const sC = new Uint8Array(MAX_P);     // livello nucleo (255 = assente)
    let pCount = 0;
    let logoFs = 0;

    for (let i = 0; i < MAX_P; i++) {
      pDL[i] = Math.random() * 0.42;
      pSW[i] = (Math.random() - 0.5) * 2.6;
      pPh[i] = Math.random() * Math.PI * 2;
      pSz[i] = 1.0 + Math.random() * 0.9;
    }

    const resetColumn = (i, initial = false) => {
      const rowH = atlas ? atlas.cellH : 22;
      colSc[i]  = 0.68 + Math.random() * 0.78;               // taglie diverse
      colLen[i] = 5 + ((Math.random() * (MAX_TRAIL - 5)) | 0);
      colV[i]   = 55 + Math.random() * 340;                  // velocità diverse
      colA[i]   = (Math.random() - 0.42) * 130;              // alcune accelerano
      colAl[i]  = 0.30 + Math.random() * 0.70;               // opacità diverse
      colY[i]   = initial
        ? Math.random() * H
        : -Math.random() * H * 0.45 - colLen[i] * rowH * colSc[i];
      // ~14% delle colonne sparisce e riparte dopo una pausa
      colWait[i] = Math.random() < 0.14 ? 0.25 + Math.random() * 1.5 : 0;
    };

    const buildColumns = () => {
      cols = Math.max(8, Math.ceil(W / tier.cellW) + 1);
      MAX_TRAIL = tier.trail;
      colY    = new Float32Array(cols);
      colV    = new Float32Array(cols);
      colA    = new Float32Array(cols);
      colLen  = new Uint8Array(cols);
      colSc   = new Float32Array(cols);
      colAl   = new Float32Array(cols);
      colWait = new Float32Array(cols);
      colBuf  = new Uint8Array(cols * MAX_TRAIL);
      for (let i = 0; i < cols; i++) resetColumn(i, true);
      for (let i = 0; i < colBuf.length; i++) colBuf[i] = pickGlyph();
    };

    const rebuildLogo = () => {
      logoCy = H * 0.445;
      const res = sampleLogoPoints(W, H, tier.stride, tier.particles, logoCy);
      // Se il campionamento fallisce (0 punti) NON azzero i target:
      // meglio il logo precedente che nessun logo.
      if (res.count > 0) {
        pCount = Math.min(res.count, MAX_P);
        logoFs = res.fontSize;
        for (let i = 0; i < pCount; i++) {
          pTX[i] = res.pts[i * 2];
          pTY[i] = res.pts[i * 2 + 1];
        }
        // Espone l'altezza reale del logo: la tagline DOM si posiziona
        // di conseguenza e non si sovrappone mai, a nessun viewport.
        document.documentElement.style.setProperty('--pre-logo-h', `${logoFs}px`);
      }
    };

    const setup = (withLogo = true) => {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, tier.dprCap);
      dprInv = 1 / dpr;
      cv.width  = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Il raggio del campo magnetico scala col viewport: 230px fissi
      // coprirebbero due terzi di uno schermo da 390px.
      fieldR = Math.max(130, Math.min(W, H) * 0.26);
      fieldR2 = fieldR * fieldR;
      atlas = buildGlyphAtlas(tier.fontPx, dpr);
      buildColumns();
      if (withLogo) rebuildLogo();
    };
    setup();

    // I webfont possono arrivare dopo il primo paint: quando sono
    // pronti ricostruisco atlante e logo, così le particelle disegnano
    // la forma definitiva e non il fallback di sistema.
    let fontsAlive = true;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        const m = modeRef.current.mode;
        // Solo se la genesi non è ancora iniziata: rimappare i target
        // a metà volo farebbe "saltare" le particelle.
        if (fontsAlive && (m === 'idle' || m === 'boot' || m === 'rain')) {
          atlas = buildGlyphAtlas(tier.fontPx, dpr);
          rebuildLogo();
        }
      }).catch(() => {});
    }

    /* ── Stato locale del loop ────────────────────────────────── */
    let raf = 0;
    let reducedPoll = 0;
    let prevTs = 0;
    let lastMode = '';
    let rainFade = 0;   // 0..1 intensità della pioggia
    let converged = 0;  // 0..1 avanzamento della genesi
    let mutAcc = 0;     // accumulatore per la mutazione dei glifi
    const DT_MAX = reduced ? DT_CLAMP_REDUCED : DT_CLAMP;

    const initConverge = () => {
      // Le particelle NASCONO dai glifi realmente a schermo: è questo
      // che rende credibile "il logo emerge dai dati".
      const useSnap = snapN > 8;
      for (let i = 0; i < pCount; i++) {
        if (useSnap) {
          const k = (i % snapN) * 2;
          pSX[i] = snap[k] + (Math.random() - 0.5) * 10;
          pSY[i] = snap[k + 1] + (Math.random() - 0.5) * 10;
        } else {
          pSX[i] = Math.random() * W;
          pSY[i] = Math.random() * H;
        }
      }
    };

    const initExplode = () => {
      const cx = W * 0.5, cy = logoCy;
      for (let i = 0; i < pCount; i++) {
        let dx = pTX[i] - cx;
        let dy = pTY[i] - cy;
        const d = Math.hypot(dx, dy) || 1;
        dx /= d; dy /= d;
        const spd = 190 + Math.random() * 760;
        pVX[i] = dx * spd + (Math.random() - 0.5) * 260;
        pVY[i] = dy * spd * 0.72 + (Math.random() - 0.5) * 260 - 70;
      }
    };

    const draw = (ts) => {
      if (!reduced) raf = requestAnimationFrame(draw);
      if (!prevTs) prevTs = ts;
      // Clamp: un frame perso NON diventa un salto. Sotto i 20fps lo
      // show rallenta invece di teletrasportarsi, e con la tab nascosta
      // (rAF fermo) la clock si congela del tutto.
      const dt = Math.min((ts - prevTs) / 1000, DT_MAX);
      prevTs = ts;

      /* ── LA SHOW-CLOCK ─────────────────────────────────────────
         Avanza qui e solo qui. Prima si consumano gli eventi dovuti,
         poi si disegna: un evento audio e il fotogramma che gli
         corrisponde cadono nello stesso frame, sempre. */
      const clock = clockRef.current;
      clock.t += dt;
      const time = clock.t;
      onFrameRef.current?.(time);

      /* ── Quality Governor ──────────────────────────────────────
         Congelato dopo la fase RAIN: degradare durante la genesi
         ricostruirebbe i target del logo con un nuovo shuffle e le
         particelle salterebbero a mezz'aria. Oltretutto il finale è
         già la fase più economica: non c'è nulla da guadagnare. */
      frameAcc += dt * 1000;
      frameCount++;
      if (frameCount >= FRAME_WINDOW) {
        const avg = frameAcc / frameCount;
        frameAcc = 0; frameCount = 0;
        const m = modeRef.current.mode;
        const canDegrade = m === 'idle' || m === 'boot' || m === 'rain';
        if (canDegrade && avg > FRAME_BUDGET && tierIdx < QUALITY_TIERS.length - 1) {
          tierIdx++;
          tier = QUALITY_TIERS[tierIdx];
          setup();
        }
      }

      /* ── Fase corrente ─────────────────────────────────────── */
      const md   = modeRef.current;
      const mode = md.mode;
      const lt   = time - md.t0;
      // Durata effettiva della fase, iniettata da React: il profilo
      // reduced-motion collassa le fasi invece di riprodurle a scatti.
      const mdur = md.dur > 0 ? md.dur : (mode === 'exit' ? D.exit : D.converge);

      if (mode !== lastMode) {
        if (mode === 'converge') initConverge();
        if (mode === 'exit')     initExplode();
        lastMode = mode;
      }

      /* ── Puntatore smussato: nessuno scatto quando esce ────── */
      const P = pointerRef.current;
      P.x += (P.tx - P.x) * Math.min(1, dt * 9);
      P.y += (P.ty - P.y) * Math.min(1, dt * 9);
      P.s += (P.ts - P.s) * Math.min(1, dt * 3.4);
      const fieldOn = P.s > 0.004;

      /* ── Canvas trasparente: il nero lo mette il layer DOM
            sottostante, che in uscita si dissolve rivelando l'Hero ── */
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;

      /* ── Intensità della pioggia per fase ──────────────────── */
      let targetRain = 0;
      if (mode === 'rain')          targetRain = 1;
      else if (mode === 'converge') targetRain = clamp01(1 - lt / 0.85) * 0.9 + 0.08;
      else if (mode === 'reveal')   targetRain = 0.09;
      else if (mode === 'exit')     targetRain = clamp01(0.09 - lt * 0.14);
      rainFade += (targetRain - rainFade) * Math.min(1, dt * 4.2);

      /* ── Camera shake durante il flare finale ──────────────── */
      const flare = flareRef.current;
      const shaking = flare > 0.003;
      if (shaking) {
        g.save();
        const mag = flare * Math.min(W, H) * 0.018;
        const shx = (Math.sin(time * 91) * 0.6 + Math.sin(time * 137) * 0.4) * mag;
        const shy = (Math.cos(time * 83) * 0.6 + Math.sin(time * 119) * 0.4) * mag;
        g.translate(shx, shy);
      }

      /* ════ 1 · FASE BOOT — respiro del CRT dietro al terminale ══ */
      if (mode === 'boot' || mode === 'idle') {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.05 + Math.sin(time * 0.9) * 0.02;
        g.fillStyle = T.emerald;
        g.fillRect(0, H * 0.5 - 2, W, 4);
        // Interferenze: micro-barre orizzontali che sfarfallano
        if (Math.random() < 0.09) {
          g.globalAlpha = 0.05 + Math.random() * 0.09;
          g.fillStyle = T.pale;
          g.fillRect(0, Math.random() * H, W, 1 + Math.random() * 2);
        }
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      }

      /* ════ 2 · PIOGGIA DIGITALE ════════════════════════════════ */
      if (rainFade > 0.004 && atlas) {
        const rowHBase = atlas.cellH;
        const cellHD = atlas.cellHD;
        const cellW = tier.cellW;
        snapN = 0;

        // Mutazione dei glifi: una piccola quota di celle cambia
        // simbolo ogni 50ms → la colonna "vive" senza ridisegnare tutto.
        mutAcc += dt;
        if (mutAcc > 0.05) {
          mutAcc = 0;
          const muts = (colBuf.length * 0.02) | 0;
          for (let m = 0; m < muts; m++) {
            colBuf[(Math.random() * colBuf.length) | 0] = pickGlyph();
          }
        }

        g.globalCompositeOperation = 'lighter';

        for (let i = 0; i < cols; i++) {
          if (colWait[i] > 0) { colWait[i] -= dt; continue; }

          // Integrazione con accelerazione: alcune colonne accelerano,
          // altre rallentano quasi fino a fermarsi, poi rimbalzano.
          colV[i] += colA[i] * dt;
          if (colV[i] < 28)  { colV[i] = 28;  colA[i] =  Math.abs(colA[i]); }
          if (colV[i] > 460) { colV[i] = 460; colA[i] = -Math.abs(colA[i]); }
          // Durante la genesi la pioggia decelera fino a fermarsi
          const slow = mode === 'converge' ? clamp01(1 - lt / 0.7) : 1;
          colY[i] += colV[i] * dt * slow;

          const sc    = colSc[i];
          const rowH  = rowHBase * sc;
          const len   = colLen[i];
          const baseX = i * cellW + cellW * 0.5;
          const headY = colY[i];

          if (headY - len * rowH > H) { resetColumn(i); continue; }

          const colAlpha = colAl[i] * rainFade;
          const halfH = rowH * 0.5;
          const dstH  = atlas.cellH * sc;
          const rowBase = i * MAX_TRAIL;

          for (let k = 0; k < len; k++) {
            const gy = headY - k * rowH;
            // La scia sale: una volta sopra il bordo, TUTTI i glifi
            // successivi sono fuori. `break`, non `continue`.
            if (gy < -rowH) break;
            if (gy > H + rowH) continue;

            // Alpha PRIMA della matematica del campo: scartare qui
            // evita una radice quadrata su glifi invisibili.
            const isHead = k === 0;
            const fall = 1 - k / len;
            let a = colAlpha * (isHead ? 1 : fall * fall * 0.82);
            if (a <= 0.008 && !fieldOn) continue;
            if (!isHead && Math.random() < 0.012) a *= 2.6; // flicker

            const gid = colBuf[rowBase + k];
            const dstW = atlas.widths[gid] * sc;
            const halfW = dstW * 0.5;

            let dx = baseX - halfW;
            let dy = gy - halfH;

            /* ── Campo magnetico: attrazione + vortice tangenziale ──
                  L'effetto è funzione PURA di (x, y, puntatore
                  smussato): quando il cursore esce, la forza scende a
                  zero per interpolazione → ritorno morbido, mai uno
                  scatto secco. */
            if (fieldOn) {
              const vx = P.x - (dx + halfW);
              const vy = P.y - (dy + halfH);
              const d2 = vx * vx + vy * vy;
              if (d2 < fieldR2) {
                const d = Math.sqrt(d2) || 1;
                const f = 1 - d / fieldR;
                const ff = f * f * P.s;
                const pull = ff * 46;
                dx += (vx / d) * pull - (vy / d) * pull * 0.42;
                dy += (vy / d) * pull + (vx / d) * pull * 0.42;
                a += ff * 0.7;
              }
            }

            if (a <= 0.01) continue;
            if (a > 1) a = 1;

            // Snap al pixel-device: elimina il filtraggio bilineare
            // che rende i glifi molli. Il movimento resta fluido
            // perché il passo è 1/dpr, non 1 pixel CSS.
            dx = Math.round(dx * dpr) * dprInv;
            dy = Math.round(dy * dpr) * dprInv;

            g.globalAlpha = a;
            g.drawImage(
              atlas.cv,
              atlas.xsD[gid], isHead ? cellHD : 0,
              atlas.wD[gid], cellHD,
              dx, dy, dstW, dstH
            );

            if (snapN < MAX_SNAP) {
              snap[snapN * 2]     = dx + halfW;
              snap[snapN * 2 + 1] = dy + halfH;
              snapN++;
            }
          }
        }

        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      }

      /* ════ 3 · SCAN SWEEP — hairline emerald additiva ══════════ */
      {
        const sweepY = ((time * 0.05) % 1.3 - 0.15) * H;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.07 + rainFade * 0.06;
        g.fillStyle = T.emerald;
        g.fillRect(0, sweepY, W, 1);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      }

      /* ════ 4 · GENESI / LOGO / ESPLOSIONE ══════════════════════
         Due passate:
           A) calcolo posizione, dimensione e livello di alpha di ogni
              particella (scratch pre-allocati, zero allocazioni);
           B) disegno RAGGRUPPATO per livello: una path per livello e
              una sola fill. 12 draw call invece di ~5200 — cambiare
              globalAlpha a ogni fillRect spezza il batching di Skia
              ed è, di gran lunga, il costo più alto del finale.     */
      if (mode === 'converge' || mode === 'reveal' || mode === 'exit') {
        const cx = W * 0.5;
        const cy = logoCy;

        converged = mode === 'converge' ? clamp01(lt / mdur) : 1;

        const exploding = mode === 'exit';
        const eAlpha = exploding ? clamp01(1 - lt / (mdur * 0.92)) : 1;
        const settled = converged >= 1;
        const fieldActive = fieldOn && converged > 0.9 && !exploding;

        // ── Passata A ────────────────────────────────────────────
        for (let i = 0; i < pCount; i++) {
          let x, y, a, sz;

          if (exploding) {
            // Drag esponenziale: le particelle partono di scatto e
            // decelerano, come materia lanciata dentro un fluido.
            const k = 1 - Math.exp(-lt * 2.3);
            x  = pTX[i] + pVX[i] * k * 0.92;
            y  = pTY[i] + pVY[i] * k * 0.92;
            a  = eAlpha * (0.55 + (i % 7) * 0.06);
            sz = pSz[i] * (1 + k * 0.9);
          } else if (settled) {
            // Respiro impercettibile: il logo è vivo, non un PNG
            x  = pTX[i] + Math.sin(time * 1.5 + pPh[i]) * 0.5;
            y  = pTY[i] + Math.cos(time * 1.2 + pPh[i]) * 0.5;
            a  = 0.72 + Math.sin(time * 2.1 + pPh[i]) * 0.14;
            sz = pSz[i];
          } else {
            const local = clamp01((converged - pDL[i]) / (1 - pDL[i]));
            const e = easeOutExpo(easeInOutCub(local));
            if (e >= 0.999) {
              x  = pTX[i];
              y  = pTY[i];
              a  = 0.82;
              sz = pSz[i];
            } else {
              // Rotazione convergente: il vettore start→target ruota
              // di uno swirl che si annulla esattamente all'arrivo.
              const rx0 = pSX[i] - cx, ry0 = pSY[i] - cy;
              const rx1 = pTX[i] - cx, ry1 = pTY[i] - cy;
              const lx = rx0 + (rx1 - rx0) * e;
              const ly = ry0 + (ry1 - ry0) * e;
              const ang = pSW[i] * (1 - e) * (1 - e);
              const ca = Math.cos(ang), sa = Math.sin(ang);
              x = cx + lx * ca - ly * sa;
              y = cy + lx * sa + ly * ca;
              // Jitter che si estingue: materia che si assesta
              const jit = (1 - e) * 7;
              x += Math.sin(time * 21 + pPh[i]) * jit;
              y += Math.cos(time * 18 + pPh[i]) * jit;
              a  = 0.20 + e * 0.62;
              sz = pSz[i] * (0.75 + e * 0.35);
            }
          }

          // Anche il logo assemblato risponde al cursore
          if (fieldActive) {
            const vx = P.x - x, vy = P.y - y;
            const d2 = vx * vx + vy * vy;
            if (d2 < fieldR2) {
              const d = Math.sqrt(d2) || 1;
              const f = 1 - d / fieldR;
              const ff = f * f * P.s;
              const push = ff * 20;
              x -= (vx / d) * push;
              y -= (vy / d) * push;
              a += ff * 0.3;
            }
          }

          if (a <= 0.012) { sL[i] = 255; sC[i] = 255; continue; }
          if (a > 1) a = 1;

          sX[i] = x - sz * 0.5;
          sY[i] = y - sz * 0.5;
          sS[i] = sz;
          let lv = (a * A_LEVELS) | 0;
          if (lv > A_LEVELS - 1) lv = A_LEVELS - 1;
          sL[i] = lv;
          // Nucleo pallido solo sopra metà alpha: il bloom nasce dalla
          // sovrapposizione additiva, non da shadowBlur (killer di
          // fill-rate).
          if (a > 0.5) {
            let cl = (((a - 0.5) * 2) * C_LEVELS) | 0;
            if (cl > C_LEVELS - 1) cl = C_LEVELS - 1;
            sC[i] = cl;
          } else {
            sC[i] = 255;
          }
        }

        // ── Passata B: corpo emerald, una fill per livello ───────
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = T.emerald;
        for (let lv = 0; lv < A_LEVELS; lv++) {
          let opened = false;
          for (let i = 0; i < pCount; i++) {
            if (sL[i] !== lv) continue;
            if (!opened) { g.beginPath(); opened = true; }
            g.rect(sX[i], sY[i], sS[i], sS[i]);
          }
          if (opened) {
            g.globalAlpha = ((lv + 0.5) / A_LEVELS) * 0.85;
            g.fill();
          }
        }

        // ── Passata B2: nucleo pallido ───────────────────────────
        g.fillStyle = T.pale;
        for (let cl = 0; cl < C_LEVELS; cl++) {
          let opened = false;
          for (let i = 0; i < pCount; i++) {
            if (sC[i] !== cl) continue;
            if (!opened) { g.beginPath(); opened = true; }
            const s = sS[i], q = s * 0.28;
            g.rect(sX[i] + q, sY[i] + q, s * 0.56, s * 0.56);
          }
          if (opened) {
            g.globalAlpha = ((cl + 0.5) / C_LEVELS) * 0.55;
            g.fill();
          }
        }

        // Alone diffuso sotto il logo assemblato
        if (converged > 0.72 && !exploding) {
          const gl = (converged - 0.72) / 0.28;
          g.globalAlpha = gl * 0.12;
          g.fillStyle = T.emerald;
          const gw = Math.min(W * 0.7, logoFs * 6.2);
          const gh = logoFs * 0.9;
          g.fillRect(cx - gw / 2, cy - gh / 2, gw, gh);
        }

        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      }

      // Chiudo il blocco "scena": ripristino il transform base prima
      // del flare, che deve coprire l'intero schermo shake escluso.
      if (shaking) g.restore();

      /* ════ 5 · FLARE ═══════════════════════════════════════════ */
      if (flare > 0.003) {
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = flare * 0.55;
        g.fillStyle = T.pale;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = flare * 0.28;
        g.fillStyle = T.emerald;
        g.fillRect(0, 0, W, H);
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    };

    if (reduced) {
      // Accessibilità: niente loop a 60fps. Un frame ogni 120ms, che
      // basta per far avanzare le fasi senza movimento continuo.
      draw(performance.now());
      reducedPoll = setInterval(() => draw(performance.now()), 120);
    } else {
      raf = requestAnimationFrame(draw);
    }

    /* ── RESIZE intelligente ──────────────────────────────────
       Ignora i resize puramente verticali (URL bar di iOS che
       appare/scompare durante lo scroll): reagisce solo a
       variazioni di larghezza > 30px o al cambio d'orientamento.
       Durante la genesi ricostruisce tutto TRANNE i target del
       logo, che rimapperebbero le particelle a mezz'aria. */
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
        const m = modeRef.current.mode;
        setup(m === 'idle' || m === 'boot' || m === 'rain');
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
      // Cleanup chirurgico: rAF, interval, timer, observer, CSS var
      fontsAlive = false;
      cancelAnimationFrame(raf);
      clearInterval(reducedPoll);
      clearTimeout(resizeTimer);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', handleResize);
      document.documentElement.style.removeProperty('--pre-logo-h');
    };
  }, [clockRef, onFrameRef, modeRef, pointerRef, flareRef, reduced]);

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
GhostScene.displayName = 'GhostScene';


/* ═══════════════════════════════════════════════════════════════
   MAIN PRELOADER
═══════════════════════════════════════════════════════════════ */
export default function Preloader({ onComplete }) {
  const containerRef = useRef(null);
  const bgRef        = useRef(null);
  const fxRef        = useRef(null);
  const termRef      = useRef(null);
  const taglineRef   = useRef(null);
  const skipRef      = useRef(null);
  const audioRef     = useRef(null);
  const exitRef      = useRef(null);
  const doneRef      = useRef(false);

  /* Canali verso il canvas — ref, MAI state: letti a 60fps senza
     provocare un solo re-render di React. */
  const modeRef    = useRef({ mode: 'idle', t0: 0, dur: 0 });
  const flareRef   = useRef(0);
  const pointerRef = useRef({ x: -9999, y: -9999, tx: -9999, ty: -9999, s: 0, ts: 0 });

  /* Show-clock condivisa + coda di eventi ordinata. */
  const clockRef   = useRef({ t: 0 });
  const queueRef   = useRef([]);
  const qiRef      = useRef(0);
  const onFrameRef = useRef(null);
  const tweensRef  = useRef([]);

  const [booting, setBooting] = useState(false);
  const [lines, setLines]     = useState([]);

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DUR = reducedMotion ? D_REDUCED : D;

  const onKey = useCallback(() => { audioRef.current?.tick(0.13); }, []);

  /* Registra i tween DOM così il cleanup può ucciderli tutti: sono
     creati dentro callback della coda, quindi fuori dalla portata di
     gsap.context(). */
  const track = useCallback((tw) => { tweensRef.current.push(tw); return tw; }, []);

  /* Con reduced-motion le fasi non vengono "riprodotte più veloci":
     collassano a durata ~0, così il canvas mostra lo stato finale
     invece di animarlo a scatti sul polling a bassa frequenza. */
  const setMode = useCallback((mode, dur = 0) => {
    modeRef.current = {
      mode,
      t0: clockRef.current.t,
      dur: reducedMotion ? 0.001 : dur,
    };
  }, [reducedMotion]);

  /* ── [AUDIO] Engine creato EAGER, distrutto al dismount ────────
     Creare l'engine NON istanzia ancora l'AudioContext: quello nasce
     in init(), dentro lo user-gesture del GateScreen. Così audioRef
     è già pronto quando il gate riceve il primo touch e l'unlock iOS
     avviene nel momento esatto autorizzato da Safari. */
  useEffect(() => {
    if (!audioRef.current) audioRef.current = createAudioEngine();
    return () => { audioRef.current?.destroy(); audioRef.current = null; };
  }, []);

  /* ── [VISIBILITÀ] Audio e video congelano INSIEME ──────────────
     Il rAF si ferma da solo quando la tab è nascosta, quindi la
     show-clock si congela; qui congelo anche l'AudioContext, così al
     ritorno non c'è un solo millisecondo di deriva fra ciò che si
     sente e ciò che si vede. Al dismount riprendo sempre: il contesto
     è condiviso col resto del sito e non va lasciato sospeso. */
  useEffect(() => {
    const onVis = () => {
      const A = audioRef.current;
      if (!A) return;
      if (document.hidden) A.suspend();
      else if (!doneRef.current) A.resume();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      audioRef.current?.resume();
    };
  }, []);

  /* ── [VH] Fallback --real-vh per Safari iOS < 15.4 ───────────── */
  useEffect(() => {
    const setRealVH = () => {
      document.documentElement.style.setProperty('--real-vh', `${window.innerHeight}px`);
    };
    setRealVH();
    window.addEventListener('resize', setRealVH, { passive: true });
    return () => window.removeEventListener('resize', setRealVH);
  }, []);

  /* ── [LOCK] Blocco scroll durante il preload ───────────────────
     ⚠️ FEATURE CRITICA PRESERVATA — NON MODIFICARE:
     gli stili precedenti di <body> vengono salvati e RIPRISTINATI
     ESATTAMENTE al dismount. È questo che restituisce a TUTTO il sito
     la barra di scorrimento destra e lo scroll (nativo o Lenis) appena
     il preloader sparisce. */
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

  /* ── [POINTER] Campo magnetico ─────────────────────────────────
     Listener PASSIVI su window: non intercettano mai touchmove in
     modo bloccante, quindi il compositor scroll del sito resta
     intatto anche mentre il preloader è montato. */
  useEffect(() => {
    const P = pointerRef.current;
    const move = (e) => {
      P.tx = e.clientX; P.ty = e.clientY; P.ts = 1;
      if (P.x < -1000) { P.x = e.clientX; P.y = e.clientY; }
    };
    const leave = () => { P.ts = 0; };
    const touch = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      P.tx = t.clientX; P.ty = t.clientY; P.ts = 1;
      if (P.x < -1000) { P.x = t.clientX; P.y = t.clientY; }
    };
    window.addEventListener('pointermove', move,   { passive: true });
    window.addEventListener('pointerleave', leave, { passive: true });
    window.addEventListener('blur', leave,         { passive: true });
    window.addEventListener('touchmove', touch,    { passive: true });
    window.addEventListener('touchend', leave,     { passive: true });
    document.addEventListener('mouseleave', leave, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
      window.removeEventListener('touchmove', touch);
      window.removeEventListener('touchend', leave);
      document.removeEventListener('mouseleave', leave);
    };
  }, []);

  /* ── [CLOCK] Consumo della coda, un frame alla volta ───────────
     Chiamata dal rAF del canvas con la show-clock aggiornata. Gli
     eventi sono ordinati: si eseguono tutti quelli dovuti e si avanza
     l'indice, quindi nessun evento può ripetersi o essere saltato. */
  useEffect(() => {
    onFrameRef.current = (t) => {
      const q = queueRef.current;
      let i = qiRef.current;
      while (i < q.length && q[i].at <= t) {
        const ev = q[i];
        i++;
        qiRef.current = i; // avanzo PRIMA di eseguire: un throw non ricicla l'evento
        ev.fn();
      }
      qiRef.current = i;
    };
    return () => { onFrameRef.current = null; };
  }, []);

  /* ── EXIT SEQUENCE ─────────────────────────────────────────────
     1. pointer-events off → il sito sotto è già interattivo
     2. braam + spegnimento di drone e ambience
     3. flare + camera shake (via flareRef, letto dal canvas)
     4. esplosione delle particelle (mode 'exit')
     5. dissolvenza del fondo: l'Hero emerge SENZA stacco visibile
     6. onComplete                                                */
  const exitSequence = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    // Da qui in poi la coda è chiusa: nessun evento residuo può
    // sparare audio sopra l'uscita (es. skip premuto a metà show).
    queueRef.current = [];
    qiRef.current = 0;

    const el = containerRef.current;
    if (!el) { onComplete?.(); return; }
    el.style.pointerEvents = 'none'; // da qui il sito sotto è interattivo

    // Dispersione, non un secondo impatto: il braam appartiene solo
    // al momento in cui il logo si compone.
    const A = audioRef.current;
    A?.shatter();
    A?.stopDrone(0.9);
    A?.stopAmbience(0.9);

    setMode('exit', DUR.exit);

    const finish = () => {
      el.style.willChange = '';
      onComplete?.();
    };

    if (reducedMotion) {
      track(gsap.to(el, {
        opacity: 0, duration: 0.6, ease: 'power2.out', force3D: true, onComplete: finish,
      }));
      return;
    }

    // Il preloader può essere saltato anche dal gate: alcuni ref sono
    // ancora nulli. Li filtro invece di passarli a GSAP.
    const veils = [bgRef.current, fxRef.current].filter(Boolean);

    const tl = track(gsap.timeline({ onComplete: finish }));
    tl
      .to(flareRef, { current: 1, duration: 0.09, ease: 'power2.in' }, 0)
      .to(flareRef, { current: 0, duration: 0.62, ease: 'power2.out' }, 0.09);

    // Il fondo si dissolve mentre le particelle sono ANCORA in volo:
    // è qui che preloader e Hero diventano un solo movimento.
    if (veils.length) {
      tl.to(veils, {
        opacity: 0, duration: 0.85, ease: 'power2.inOut', force3D: true,
      }, 0.16);
    }
    if (taglineRef.current) {
      tl.to(taglineRef.current, {
        opacity: 0, y: -26, filter: 'blur(10px)',
        duration: 0.55, ease: 'power3.in', force3D: true,
      }, 0.02);
    }
    if (skipRef.current) {
      tl.to(skipRef.current, { opacity: 0, duration: 0.3, ease: 'power2.out' }, 0);
    }
    tl.to(el, {
      opacity: 0, duration: 0.34, ease: 'power2.inOut', force3D: true,
    }, Math.max(0.4, DUR.exit - 0.36));
  }, [reducedMotion, onComplete, setMode, track, DUR.exit]);

  // exitRef tiene l'ultima closure senza rientrare nel render path.
  useEffect(() => { exitRef.current = exitSequence; }, [exitSequence]);

  /* ── Skip: Esc da tastiera + controllo visibile ───────────────── */
  const skip = useCallback(() => { exitRef.current?.(); }, []);
  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') skip(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [skip]);

  /* ── GATE ENTER ────────────────────────────────────────────────
     L'engine è già sbloccato dentro il gesture del gate: qui basta
     un init() idempotente di sicurezza e la partenza della sequenza. */
  const handleGateEnter = useCallback(() => {
    audioRef.current?.init();
    setBooting(true);
  }, []);

  /* ── COREOGRAFIA COMPLETA ──────────────────────────────────────
     Una coda di eventi in show-clock, non timer indipendenti. Audio,
     cambi di fase e tween partono dallo stesso frame del canvas.   */
  useEffect(() => {
    if (!booting) return;
    const A = audioRef.current;

    const q = [];
    const at = (t, fn) => q.push({ at: Math.max(0, t), fn });

    /* ─ ATTO 1 · TERMINALE ─────────────────────────────────── */
    const step = (DUR.boot - 0.45) / BOOT_LINES.length;
    BOOT_LINES.forEach((line, i) => {
      at(0.28 + i * step, () => {
        setLines(prev => (prev.length > i ? prev : [...prev, line]));
        if (line.accent) { A?.glitch(0.16); A?.beep(1180, 0.07, 0.16); }
        else if (i % 2 === 0) A?.beep(1620 + i * 90, 0.035, 0.07);
      });
    });
    at(DUR.boot * 0.42, () => A?.glitch(0.08));
    at(DUR.boot * 0.74, () => A?.glitch(0.07));

    /* ─ ATTO 2 · PIOGGIA ───────────────────────────────────── */
    const tRain = DUR.boot;
    at(tRain - 0.2, () => {
      if (!termRef.current) return;
      track(gsap.to(termRef.current, {
        opacity: 0, y: -14, filter: 'blur(7px)',
        duration: 0.75, ease: 'power3.inOut', force3D: true,
      }));
    });

    if (DUR.rain > 0) {
      at(tRain, () => {
        setMode('rain', DUR.rain);
        A?.startDrone();
        A?.setIntensity(0.55);
        A?.glitch(0.15);
        A?.dataBurst(20, 0.7);
      });
      at(tRain + DUR.rain * 0.42, () => A?.dataBurst(14, 0.6));
      at(tRain + DUR.rain * 0.72, () => {
        A?.beep(880, 0.05, 0.12);
        A?.setIntensity(0.82);
      });
      at(tRain + DUR.rain - 1.35, () => A?.sweep(1.7));
    }

    /* ─ ATTO 3 · GENESI DEL LOGO ───────────────────────────── */
    const tConv = tRain + DUR.rain;
    at(tConv, () => {
      setMode('converge', DUR.converge);
      A?.setIntensity(1);
      A?.dataBurst(26, 0.9);
    });

    /* ─ ATTO 4 · LOGO + TAGLINE ────────────────────────────── */
    const tReveal = tConv + DUR.converge;
    at(tReveal - 0.16, () => {
      A?.braam();
      A?.setIntensity(0.35);
    });
    at(tReveal, () => setMode('reveal', DUR.reveal));
    at(tReveal + 0.16, () => {
      if (!taglineRef.current) return;
      track(gsap.fromTo(
        taglineRef.current.querySelectorAll('.tag-row'),
        { opacity: 0, y: 26, filter: 'blur(9px)' },
        {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: 1.25, ease: 'expo.out', force3D: true, stagger: 0.14,
        }
      ));
    });

    /* ─ ATTO 5 · USCITA ────────────────────────────────────── */
    at(tReveal + DUR.reveal, () => exitRef.current?.());

    // La coda deve essere ordinata: il consumo si ferma al primo
    // evento non ancora dovuto.
    q.sort((a, b) => a.at - b.at);

    // Azzero la clock QUI: da questo istante i tempi della coda sono
    // assoluti rispetto all'inizio dello show.
    clockRef.current.t = 0;
    queueRef.current = q;
    qiRef.current = 0;

    setMode('boot', DUR.boot);
    A?.setIntensity(0.15);

    return () => {
      queueRef.current = [];
      qiRef.current = 0;
      tweensRef.current.forEach(tw => { try { tw.kill(); } catch { /* già morto */ } });
      tweensRef.current = [];
    };
  }, [booting, DUR, setMode, track]);

  return (
    <div
      ref={containerRef}
      className="ghost-pre"
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%',
        // height gestita da .ghost-pre (100svh + fallback --real-vh)
        backgroundColor: 'transparent', // il nero vive nel layer bgRef
        fontFamily: MONO,
        overflow: 'hidden',
        color: T.bone,
        touchAction: 'none',
        overscrollBehavior: 'none',
        willChange: 'opacity',
        zIndex: 9999,
      }}
    >
      {/* Fondo OLED — si dissolve nell'exit rivelando l'Hero */}
      <div
        ref={bgRef}
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: `radial-gradient(ellipse at 50% 44%, #0A0F0C 0%, ${T.void} 62%)`,
          willChange: 'opacity',
        }}
      />

      {/* Scena canvas — viva già dietro il gate */}
      <GhostScene
        clockRef={clockRef}
        onFrameRef={onFrameRef}
        modeRef={modeRef}
        pointerRef={pointerRef}
        flareRef={flareRef}
        reduced={reducedMotion}
      />

      {/* Strato FX statico: scanline + grana + vignettatura.
          Fisso e pointer-events:none → zero costo per frame. */}
      <div ref={fxRef} aria-hidden className="ghost-fx" style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        willChange: 'opacity',
      }}>
        <div className="fx-scan" />
        <div className="fx-grain" />
        <div className="fx-vig" />
      </div>

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <div className="ghost-chrome" style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: `1rem ${PX}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${T.hairline}`,
        fontSize: 'clamp(0.5rem, 1.1vw, 0.6rem)',
        color: T.boneDim, letterSpacing: '0.24em', textTransform: 'uppercase',
        zIndex: 6, gap: '0.75rem', pointerEvents: 'none',
      }}>
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          minWidth: 0, flexShrink: 1,
        }}>
          SM—26 / GHOST PROTOCOL
        </span>
        <span style={{
          color: T.emerald, letterSpacing: '0.16em',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          ● LIVE
        </span>
      </div>

      {/* ── TERMINALE (Atto 1) ──────────────────────────────── */}
      {booting && (
        <div
          ref={termRef}
          aria-hidden
          className="ghost-term"
          style={{
            position: 'absolute', zIndex: 3,
            left: PX, right: PX,
            top: '50%', transform: 'translateY(-50%)',
            maxWidth: '46rem', marginInline: 'auto',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
            fontSize: 'clamp(0.56rem, 1.25vw, 0.78rem)',
            lineHeight: 1.6, letterSpacing: '0.1em',
            willChange: 'transform, opacity, filter',
            pointerEvents: 'none',
          }}
        >
          {lines.map((l, i) => (
            <TypeLine key={i} text={l.text} code={l.code} accent={l.accent} onKey={onKey} />
          ))}
          {lines.length > 0 && lines.length < BOOT_LINES.length && (
            <span className="term-cursor" aria-hidden style={{
              width: '0.55em', height: '1.05em',
              background: T.emerald, display: 'inline-block',
              boxShadow: '0 0 14px rgba(43,224,140,0.6)',
            }} />
          )}
        </div>
      )}

      {/* ── TAGLINE (Atto 4) ────────────────────────────────── */}
      <div
        ref={taglineRef}
        className="ghost-tagline"
        style={{
          position: 'absolute', zIndex: 4,
          left: 0, right: 0,
          top: 'calc(44.5% + var(--pre-logo-h, 6rem) * 0.72)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0.55rem', padding: `0 ${PX}`, boxSizing: 'border-box',
          textAlign: 'center', pointerEvents: 'none',
          willChange: 'transform, opacity, filter',
        }}
      >
        <span className="tag-row" style={{
          opacity: 0,
          fontFamily: MONO,
          fontSize: 'clamp(0.58rem, 1.5vw, 0.82rem)',
          letterSpacing: '0.42em', textTransform: 'uppercase',
          color: T.bone,
        }}>
          Escape ordinary
        </span>
        <span className="tag-row" style={{
          opacity: 0,
          fontFamily: MONO,
          fontSize: 'clamp(0.47rem, 1.05vw, 0.6rem)',
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: T.emeraldSoft,
        }}>
          Build unforgettable experiences
        </span>
      </div>

      {/* ── SKIP ────────────────────────────────────────────── */}
      {booting && (
        <button
          ref={skipRef}
          type="button"
          onClick={skip}
          className="ghost-skip"
          style={{
            position: 'absolute', zIndex: 7,
            right: PX, bottom: 'clamp(1.1rem, 4svh, 2.4rem)',
            display: 'inline-flex', alignItems: 'center', gap: '0.7rem',
            padding: '0.55rem 0.55rem 0.55rem 1.05rem',
            borderRadius: '999px',
            background: 'rgba(232,233,230,0.03)',
            border: '1px solid rgba(232,233,230,0.09)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.07)',
            color: T.boneDim, fontFamily: MONO, cursor: 'pointer',
            fontSize: 'clamp(0.45rem, 0.95vw, 0.55rem)',
            letterSpacing: '0.26em', textTransform: 'uppercase',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span>Skip</span>
          {/* Button-in-button anche qui: coerenza del sistema */}
          <span className="skip-orb" aria-hidden style={{
            width: '1.55rem', height: '1.55rem', borderRadius: '999px',
            background: 'rgba(232,233,230,0.06)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.5"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 5l7 7-7 7" /><path d="M13 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      )}

      {/* ── ANNUNCIO ACCESSIBILE ────────────────────────────── */}
      <p className="ghost-sr" role="status" aria-live="polite">
        {booting ? 'Sequenza di avvio in corso' : 'Premi Enter per avviare l’esperienza'}
      </p>

      {/* Gate — sblocca l'audio al primo gesto */}
      {!booting && <GateScreen onEnter={handleGateEnter} audioRef={audioRef} />}

      <style>{`
        /* ── VIEWPORT HEIGHT ──────────────────────────────────
           100svh segue la URL bar di iOS Safari (15.4+).
           Fallback --real-vh calcolata via JS per i legacy.    */
        .ghost-pre { height: 100svh; }
        @supports not (height: 1svh) {
          .ghost-pre { height: var(--real-vh, 100vh); }
        }

        .ghost-sr {
          position: absolute; width: 1px; height: 1px;
          padding: 0; margin: -1px; overflow: hidden;
          clip: rect(0 0 0 0); white-space: nowrap; border: 0;
        }

        /* ── FX: scanline CRT ─────────────────────────────────
           Bande scure in source-over normale. NIENTE mix-blend-mode:
           un blend a schermo intero sopra un canvas che cambia ogni
           frame obbliga la GPU a ri-comporre il backdrop 60 volte al
           secondo — su mobile è il singolo effetto più costoso di
           tutta la scena. Su fondo nero il risultato è identico.   */
        .fx-scan {
          position: absolute; inset: 0;
          background: repeating-linear-gradient(
            0deg,
            rgba(0,0,0,0) 0px,
            rgba(0,0,0,0) 2px,
            rgba(0,0,0,0.34) 3px,
            rgba(0,0,0,0) 4px
          );
          opacity: 0.5;
        }

        /* ── FX: grana analogica (SVG feTurbulence inline) ──── */
        .fx-grain {
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
          opacity: 0.055;
          animation: grainShift 6s steps(6) infinite;
        }
        @keyframes grainShift {
          0%   { transform: translate3d(0,0,0) }
          16%  { transform: translate3d(-2%,1%,0) }
          33%  { transform: translate3d(1%,-2%,0) }
          50%  { transform: translate3d(-1%,-1%,0) }
          66%  { transform: translate3d(2%,1%,0) }
          83%  { transform: translate3d(-2%,2%,0) }
          100% { transform: translate3d(0,0,0) }
        }

        /* ── FX: vignettatura ─────────────────────────────────── */
        .fx-vig {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 45%,
            rgba(0,0,0,0) 28%, rgba(0,0,0,0.62) 78%, rgba(0,0,0,0.86) 100%);
        }

        /* ── TERMINALE: sfarfallio CRT irregolare ─────────────── */
        .ghost-term { animation: crtFlick 7.3s cubic-bezier(0.32,0.72,0,1) infinite; }
        @keyframes crtFlick {
          0%, 100% { opacity: 1 }
          6%    { opacity: 0.82 }
          6.4%  { opacity: 1 }
          31%   { opacity: 0.90 }
          31.5% { opacity: 1 }
          58%   { opacity: 0.74 }
          58.6% { opacity: 1 }
          79%   { opacity: 0.92 }
          79.4% { opacity: 1 }
        }
        .term-line { animation: lineIn 700ms cubic-bezier(0.32,0.72,0,1) both; }
        @keyframes lineIn {
          from { opacity: 0; transform: translate3d(0,10px,0) }
          to   { opacity: 1; transform: translate3d(0,0,0) }
        }
        .term-cursor { animation: curBlink 1.05s cubic-bezier(0.45,0,0.55,1) infinite; }
        @keyframes curBlink { 0%,100% { opacity: 1 } 50% { opacity: 0.08 } }

        /* ── SKIP: fisica del bottone nested ─────────────────── */
        .ghost-skip {
          transition: transform 700ms cubic-bezier(0.32,0.72,0,1),
                      color 700ms cubic-bezier(0.32,0.72,0,1),
                      border-color 700ms cubic-bezier(0.32,0.72,0,1);
          will-change: transform;
        }
        .ghost-skip:hover { color: ${T.bone}; border-color: rgba(43,224,140,0.28); }
        .ghost-skip:active { transform: scale(0.978); }
        .ghost-skip:focus-visible { outline: 1px solid rgba(43,224,140,0.5); outline-offset: 4px; }
        .skip-orb {
          transition: transform 700ms cubic-bezier(0.32,0.72,0,1);
          will-change: transform;
        }
        .ghost-skip:hover .skip-orb { transform: translate3d(3px,-1px,0) scale(1.06); }

        /* ── MOBILE COLLAPSE ─────────────────────────────────── */
        @media (max-width: 767px) {
          .ghost-term { gap: 0.42rem !important; max-width: 100% !important; }
          .term-code { display: none !important; }
          .ghost-chrome { padding-left: 1rem !important; padding-right: 1rem !important; }
          .fx-scan { opacity: 0.4; }
        }

        /* ── ACCESSIBILITÀ ───────────────────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .fx-grain, .ghost-term, .term-line, .term-cursor { animation: none !important; }
          .ghost-skip, .skip-orb { transition: none !important; }
        }
      `}</style>
    </div>
  );
}