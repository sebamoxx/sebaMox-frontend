import { useRef, useEffect, useState, useCallback, useId } from "react";

/**
 * ============================================================================
 *  StressTestSection.jsx — "IL SIMULATORE DI COLLASSO"  ::  rev 3.0 / GPU
 * ----------------------------------------------------------------------------
 *  Swiss-Cyber Brutalist / High-End Tech interactive panel.
 *
 *  CORE ENGINEERING PHILOSOPHY
 *  ---------------------------
 *  The counter sweeps from 100 -> 50.000 simultaneous users. Routing that value
 *  through React state at 60fps would trigger thousands of reconciliations per
 *  hold and torch the frame budget. So everything that animates lives in
 *  `useRef` + a single imperative requestAnimationFrame loop that writes
 *  DIRECTLY to the DOM. React renders the static shell exactly once; `useState`
 *  is reserved ONLY for the infrastructure-mode toggle (a rare, intentional
 *  re-architecture). NEVER setState inside the rAF loop.
 *
 *  WHAT CHANGED IN rev 3.0 (the performance + Awwwards pass)
 *  ---------------------------------------------------------
 *   1. THEME VIA CSS CUSTOM PROPERTIES, NOT CLASS SWAPS.
 *      The old build flipped `.is-nominal | .is-warning | .is-critical` classes
 *      on the wrapper. A class swap invalidates a huge selector-matching subtree
 *      and snaps colours between 3 discrete steps. Instead we now interpolate
 *      `--accent / --fg / --glow / --load / --collapse` every frame and push them
 *      with `el.style.setProperty(...)`. The browser only re-resolves the handful
 *      of declarations that *read* those vars — no selector re-match, no layout
 *      thrash — and colour becomes a continuous, millisecond-fluid ramp.
 *
 *   2. STRICT READ-BEFORE-WRITE BATCHING.
 *      `renderFrame()` is WRITE-ONLY: zero geometry reads, so it can never trip a
 *      forced synchronous layout. The only `getBoundingClientRect()` in the whole
 *      component lives in the pointer-move handler (event time, not frame time)
 *      and writes nothing — it just stores a target the loop later consumes.
 *      Per-property dedupe (`themeRef`) skips redundant writes when a value is
 *      unchanged, so an idle/hover frame writes almost nothing.
 *
 *   3. GPU-ONLY MOTION.
 *      Everything kinetic (button, SVG core, gauge fill, glow overlay) animates
 *      via `translate3d` / `scaleX` / `opacity` on its own promoted layer
 *      (`will-change`). We never touch top/left/width/height.
 *
 *   4. ORGANIC SVG GLITCH FILTER.
 *      The crude per-frame random-walk `translate` jitter is replaced by a real
 *      SVG filter pipeline — `feTurbulence -> feDisplacementMap` for organic warp
 *      plus a 3-way `feColorMatrix` channel split + `feOffset` for true RGB
 *      chromatic aberration. The filter is gated OFF (zero cost) below the warn
 *      band and its `scale` / offsets are driven live by the user count.
 *
 *   5. DECODE / SCRAMBLE TERMINAL, screen-blend "radioactive" glow, proportional
 *      haptics, and a JS spring for the magnetic button — all driven from the one
 *      rAF loop (see inline notes).
 *
 *   6. SLEEP MODE. An IntersectionObserver (and a visibilitychange guard) cancels
 *      the loop when the section is off-screen or the tab is hidden, so an idle
 *      simulator costs zero CPU. No external libs (no GSAP, no Tailwind).
 * ============================================================================
 */

/* ---------------------------------------------------------------------------
 * TUNING CONSTANTS — single source of truth for the simulation parameters.
 * ------------------------------------------------------------------------- */
const USERS_MIN = 100; // idle baseline
const USERS_MAX = 50000; // saturation target while holding
const WARN_THRESHOLD = 5000; // STANDARD: servers start to shudder
const CRITICAL_THRESHOLD = 20000; // STANDARD: colour flips to error red, violent glitch

// Exponential smoothing base (per ~16.67ms frame). Higher = snappier ramp.
// Re-normalised against real delta-time each frame so the curve is identical
// at 30/60/120fps.
const SMOOTH_BASE = 0.055;

// Magnetic button: cursor pull strength + spring stiffness (per 16.67ms frame).
const MAGNET_PULL = 0.22; // fraction of cursor offset the button chases
const MAGNET_STIFF = 0.2; // lerp factor -> higher = snappier follow

// Decode/scramble reveal duration per log line, and how many may decode at once.
const DECODE_MS = 240;
const MAX_ACTIVE_DECODES = 4;
const SCRAMBLE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&/<>*+=";

// Throttle for terminal output so logs arrive in readable "bursts".
const LOG_INTERVAL_MS = 110;
const MAX_LOG_LINES = 14; // ring-buffer cap to keep the DOM tiny

/* ---------------------------------------------------------------------------
 * PALETTE (numeric RGB triplets so we can interpolate them per frame).
 * ------------------------------------------------------------------------- */
const C_CREAM = [240, 230, 211]; // #F0E6D3
const C_ORANGE = [244, 162, 97]; // #F4A261
const C_RED = [255, 59, 48]; // #FF3B30
const C_GREEN = [74, 246, 38]; // #4AF626

/* Pre-computed normalised load values (0..1) for the two STANDARD thresholds. */
const WARN_LOAD = (WARN_THRESHOLD - USERS_MIN) / (USERS_MAX - USERS_MIN); // ~0.098
const CRIT_LOAD = (CRITICAL_THRESHOLD - USERS_MIN) / (USERS_MAX - USERS_MIN); // ~0.399

/* ---------------------------------------------------------------------------
 * Tiny pure math/colour helpers (module scope so they're never re-allocated).
 * ------------------------------------------------------------------------- */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0 || 1));
  return t * t * (3 - 2 * t);
};
const mixRGB = (c1, c2, t) => [
  Math.round(lerp(c1[0], c2[0], t)),
  Math.round(lerp(c1[1], c2[1], t)),
  Math.round(lerp(c1[2], c2[2], t)),
];
const toRGB = (c) => "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
const toRGBA = (c, a) =>
  "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")";

/* ---------------------------------------------------------------------------
 * LOG VOCABULARIES — the strings the terminal "spits out" per mode/state.
 * ------------------------------------------------------------------------- */
const LOGS_STANDARD_WARN = [
  "WARN  >> request queue depth rising :: 1.2k pending",
  "WARN  >> single-thread event loop blocked for 840ms",
  "WARN  >> cache MISS ratio 71% // disk I/O saturating",
  "WARN  >> gc pause detected :: heap 91% committed",
];
const LOGS_STANDARD_CRITICAL = [
  "ERROR >> 500 INTERNAL SERVER ERROR",
  "ERROR >> TIMEOUT :: upstream did not respond in 30000ms",
  "FATAL >> DATABASE CONNECTIONS EXCEEDED (max_conns=100)",
  "ERROR >> 502 BAD GATEWAY // worker pool exhausted",
  "FATAL >> SEGFAULT in php-fpm pool :: respawning...",
  "FATAL >> SYSTEM COLLAPSED // node unreachable",
];
const LOGS_CUSTOM_RAMP = [
  "INFO  >> ASYNC THREAD POOL: SCALING... +8 workers",
  "INFO  >> LOAD BALANCER: ACTIVE :: round-robin healthy",
  "INFO  >> CPU CORE: 32% // COOLING: OPTIMAL",
  "INFO  >> redis hit ratio 99.4% :: p99 latency 11ms",
  "INFO  >> autoscaler: provisioning replica 0xA3",
  "INFO  >> backpressure absorbed :: queue drained",
];
const LOGS_CUSTOM_STABLE = [
  "OK    >> STATUS: 200 OK :: 50,000 sessions served",
  "OK    >> throughput steady 48.7k req/s // 0 errors",
  "OK    >> event loop idle 64% :: headroom nominal",
];

export default function StressTestSection() {
  /* ===========================================================================
   * REACT STATE — intentionally minimal. `mode` is the ONLY value allowed to
   * trigger a re-render. Everything that animates is held in refs below.
   * ========================================================================= */
  const [mode, setMode] = useState("standard"); // "standard" | "custom"

  /* A collision-proof id for the SVG filter (so multiple instances never clash).
   * useId() yields e.g. ":r3:"; strip chars that are illegal in selectors/url(). */
  const FILTER_ID = ("stsimGlitch" + useId()).replace(/[^a-zA-Z0-9_-]/g, "");

  /* ===========================================================================
   * DOM REFS — the imperative animation surface.
   * ========================================================================= */
  const sectionRef = useRef(null); // IntersectionObserver target / root
  const panelRef = useRef(null); // receives the live CSS theme variables
  const radioRef = useRef(null); // screen-blend "radioactive" glow overlay
  const counterRef = useRef(null); // the giant monospace number node
  const labelRef = useRef(null); // the "[ SIMULTANEOUS_USERS: N ]" badge node
  const svgWrapRef = useRef(null); // SVG container (transform: breathing / shake)
  const svgRef = useRef(null); // the <svg> itself (CSS `filter` toggle target)
  const gaugeFillRef = useRef(null); // load-bar fill (scaleX)
  const buttonRef = useRef(null); // magnetic hold button
  const btnLabelRef = useRef(null); // button caption (text swaps on hold)
  const terminalRef = useRef(null); // log scroll container

  /* Live SVG-filter primitives we mutate via setAttribute (resolved on mount). */
  const turbRef = useRef(null); // <feTurbulence>     -> organic warp source
  const dispRef = useRef(null); // <feDisplacementMap> -> warp amount (scale)
  const rOffRef = useRef(null); // <feOffset> red channel  -> chromatic split +x
  const bOffRef = useRef(null); // <feOffset> blue channel -> chromatic split -x

  /* ===========================================================================
   * MUTABLE SIMULATION STATE — refs so updates never re-render.
   * ========================================================================= */
  const usersRef = useRef(USERS_MIN); // current interpolated user count
  const injectingRef = useRef(false); // is the button currently held?
  const modeRef = useRef(mode); // mirror of `mode` readable inside rAF
  const rafRef = useRef(null); // active animation frame id (or null)
  const lastTsRef = useRef(0); // timestamp of previous frame (for dt)
  const lastLogTsRef = useRef(0); // timestamp of last emitted log line
  const lastHapticRef = useRef(0); // timestamp of last vibration pulse
  const isVisibleRef = useRef(true); // IntersectionObserver visibility flag
  const reducedRef = useRef(false); // prefers-reduced-motion snapshot
  const filterOnRef = useRef(false); // is the SVG glitch filter currently applied?
  const collapsedRef = useRef(false); // STANDARD: latched "SYSTEM COLLAPSED" log
  const stableLoggedRef = useRef(false); // CUSTOM: latched "200 OK" log
  const themeRef = useRef({}); // last-written CSS-var values (write dedupe)
  const activeDecodesRef = useRef([]); // log nodes still resolving their scramble

  /* Magnetic button physics (a JS spring instead of CSS cubic-beziers). */
  const magnetTargetRef = useRef({ x: 0, y: 0 }); // where the cursor wants it
  const magnetCurrentRef = useRef({ x: 0, y: 0 }); // where it actually is (lerped)
  const magnetActiveRef = useRef(false); // pointer currently engaging the button?

  /* Keep the ref mirror of `mode` in sync so the rAF loop reads fresh values. */
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  /* ---------------------------------------------------------------------------
   * formatUsers — thousands-separated integer, e.g. 50000 -> "50,000".
   * ------------------------------------------------------------------------- */
  const formatUsers = (n) => {
    const v = Math.round(n);
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  /* ---------------------------------------------------------------------------
   * finalizeDecodes — snap every in-flight scramble to its final string. Called
   * when we go to sleep so no line is ever frozen mid-decode off-screen.
   * ------------------------------------------------------------------------- */
  const finalizeDecodes = useCallback(() => {
    const list = activeDecodesRef.current;
    for (let i = 0; i < list.length; i++) {
      const ln = list[i];
      if (ln && ln._full != null) ln.textContent = ln._full;
    }
    list.length = 0;
  }, []);

  /* ---------------------------------------------------------------------------
   * pushLog — append a single line to the terminal as a real DOM node. Instead
   * of showing the text instantly we register it for a per-frame "decode"
   * (random glyphs resolving into the final string). All outside React.
   * ------------------------------------------------------------------------- */
  const pushLog = useCallback((text, kind) => {
    const term = terminalRef.current;
    if (!term) return;

    const line = document.createElement("div");
    line.className = "stsim__logline stsim__logline--" + kind;

    // Faux millisecond clock prefix for telemetry flavour.
    const clock = (performance.now() % 100000).toFixed(0).padStart(5, "0");
    const prefix = "[" + clock + "ms] ";
    const full = prefix + text;

    if (reducedRef.current) {
      // Reduced-motion: no scramble, just print it.
      line.textContent = full;
    } else {
      // Stash decode metadata on the node and show the prefix immediately; the
      // rAF loop reveals the message body character-by-character.
      line._full = full;
      line._from = prefix.length; // chars before this are shown verbatim
      line._start = performance.now();
      line.textContent = prefix;
      const active = activeDecodesRef.current;
      active.push(line);
      // Cap concurrent decodes: finalise the oldest so we never build a backlog.
      while (active.length > MAX_ACTIVE_DECODES) {
        const old = active.shift();
        if (old && old._full != null) old.textContent = old._full;
      }
    }

    term.appendChild(line);

    // Ring-buffer: drop oldest node(s) past the cap -> bounded DOM = stable cost.
    while (term.childElementCount > MAX_LOG_LINES) {
      term.removeChild(term.firstElementChild);
    }
    // Pin to bottom WITHOUT reading scrollHeight (that would force a layout):
    // an over-large scrollTop is silently clamped to the max by the browser.
    term.scrollTop = 1e6;
  }, []);

  /* ---------------------------------------------------------------------------
   * renderFrame — the single imperative paint. WRITE-ONLY (no geometry reads),
   * so it can never trigger a forced synchronous layout. Receives `dt` (ms since
   * last frame) for frame-rate-independent springs.
   * ------------------------------------------------------------------------- */
  const renderFrame = useCallback(
    (now, dt) => {
      const users = usersRef.current;
      const isCustom = modeRef.current === "custom";
      const load = clamp01((users - USERS_MIN) / (USERS_MAX - USERS_MIN));
      const reduced = reducedRef.current;
      const th = themeRef.current;

      /* ====================================================================
       * A. THEME — interpolate colours from `load` and push them as CSS vars.
       *    Continuous instead of 3 discrete class states; per-prop dedupe means
       *    a steady frame writes nothing.
       * ==================================================================== */
      let accent, fg, collapse, glowA, coreFillA, radioOp;

      if (isCustom) {
        // CUSTOM ARCHITECTURE: always healthy. Brilliant neon green, glow grows
        // gently toward saturation; never collapses.
        accent = C_GREEN;
        fg = C_GREEN;
        collapse = 0;
        glowA = 0.2 + load * 0.55;
        coreFillA = load * 0.2;
        radioOp = load * 0.32;
      } else {
        // STANDARD TEMPLATE: degrade as load climbs.
        // accent: orange -> red across the warn..critical band.
        const aT = smoothstep(WARN_LOAD, CRIT_LOAD, load);
        accent = mixRGB(C_ORANGE, C_RED, aT);
        // collapse: 0 at critical -> 1 at saturation (drives the violent stuff).
        collapse = smoothstep(CRIT_LOAD, 1, load);
        // fg: cream stays legible until we're well past critical, then bleeds red.
        fg = mixRGB(C_CREAM, C_RED, smoothstep(CRIT_LOAD * 0.92, 1, load));
        glowA = 0.15 + load * 0.5 + collapse * 0.3;
        coreFillA = collapse * 0.18;
        radioOp = collapse * 0.55;
      }

      // Flicker the radioactive overlay only in the danger zone (and never under
      // reduced-motion). A multiplicative jitter reads as an unstable neon tube.
      if (!reduced && (collapse > 0.4 || (isCustom && load > 0.9))) {
        radioOp *= 0.7 + Math.random() * 0.5;
      }

      const accentStr = toRGB(accent);
      const fgStr = toRGB(fg);
      const glowStr = toRGBA(accent, glowA);
      const borderStr = toRGBA(accent, 0.1 + load * 0.45 + collapse * 0.2);
      const coreStr = coreFillA > 0.001 ? toRGBA(accent, coreFillA) : "transparent";
      const loadStr = load.toFixed(3);
      const collapseStr = collapse.toFixed(3);
      const radioStr = radioOp.toFixed(3);

      const panel = panelRef.current;
      if (panel) {
        // Dedupe each property: only write when the resolved value actually moved.
        if (th.accent !== accentStr) {
          panel.style.setProperty("--accent", accentStr);
          th.accent = accentStr;
        }
        if (th.fg !== fgStr) {
          panel.style.setProperty("--fg", fgStr);
          th.fg = fgStr;
        }
        if (th.glow !== glowStr) {
          panel.style.setProperty("--glow", glowStr);
          th.glow = glowStr;
        }
        if (th.border !== borderStr) {
          panel.style.setProperty("--border", borderStr);
          th.border = borderStr;
        }
        if (th.core !== coreStr) {
          panel.style.setProperty("--core-fill", coreStr);
          th.core = coreStr;
        }
        if (th.load !== loadStr) {
          panel.style.setProperty("--load", loadStr);
          th.load = loadStr;
        }
        if (th.collapse !== collapseStr) {
          panel.style.setProperty("--collapse", collapseStr);
          th.collapse = collapseStr;
        }
      }
      if (radioRef.current && th.radio !== radioStr) {
        radioRef.current.style.opacity = radioStr;
        th.radio = radioStr;
      }

      /* ====================================================================
       * B. COUNTER + telemetry badge (deduped so a steady value writes nothing).
       * ==================================================================== */
      const countStr = formatUsers(users);
      if (th.count !== countStr) {
        if (counterRef.current) counterRef.current.textContent = countStr;
        if (labelRef.current) {
          labelRef.current.textContent =
            "[ SIMULTANEOUS_USERS: " + countStr + " ]";
        }
        th.count = countStr;
      }

      /* ====================================================================
       * C. LOAD GAUGE (scaleX 0..1) — transform-only, GPU friendly, deduped.
       * ==================================================================== */
      if (gaugeFillRef.current) {
        const gaugeStr = "scaleX(" + load.toFixed(4) + ")";
        if (th.gauge !== gaugeStr) {
          gaugeFillRef.current.style.transform = gaugeStr;
          th.gauge = gaugeStr;
        }
      }

      /* ====================================================================
       * D. SVG GLITCH FILTER — organic displacement + RGB chromatic split.
       *    Gated OFF entirely below the warn band (zero filter cost at rest).
       * ==================================================================== */
      const glitch = isCustom || reduced ? 0 : smoothstep(WARN_LOAD, 1, load);
      if (glitch > 0.001) {
        if (!filterOnRef.current && svgRef.current) {
          svgRef.current.style.filter = "url(#" + FILTER_ID + ")";
          filterOnRef.current = true;
        }
        // Warp magnitude: eased ramp + occasional violent spike past critical.
        if (dispRef.current) {
          let scale = glitch * glitch * 10;
          if (collapse > 0 && Math.random() < 0.18) {
            scale += Math.random() * collapse * 14;
          }
          dispRef.current.setAttribute("scale", Math.min(18, scale).toFixed(2));
        }
        // Chromatic aberration: push R and B channels apart, jitter at collapse.
        if (rOffRef.current && bOffRef.current) {
          const ca = glitch * 3.2 + (collapse > 0 ? (Math.random() - 0.5) * collapse * 5 : 0);
          const cay = collapse > 0 ? (Math.random() - 0.5) * collapse * 3 : 0;
          rOffRef.current.setAttribute("dx", ca.toFixed(2));
          rOffRef.current.setAttribute("dy", cay.toFixed(2));
          bOffRef.current.setAttribute("dx", (-ca).toFixed(2));
          bOffRef.current.setAttribute("dy", (-cay * 0.6).toFixed(2));
        }
        // Slow-drifting turbulence so the warp lives & breathes instead of buzzing
        // on a fixed pattern; frequency also tightens as load climbs.
        if (turbRef.current) {
          const fx = Math.max(0.001, 0.006 + glitch * 0.02 + Math.sin(now / 700) * 0.003);
          const fy = Math.max(0.001, 0.02 + glitch * 0.05 + Math.cos(now / 900) * 0.006);
          turbRef.current.setAttribute("baseFrequency", fx.toFixed(4) + " " + fy.toFixed(4));
        }
      } else if (filterOnRef.current && svgRef.current) {
        svgRef.current.style.filter = "none";
        filterOnRef.current = false;
      }

      /* ====================================================================
       * E. SVG WRAP TRANSFORM — calm breathing (custom) or a small physical
       *    shake at terminal collapse (the filter does the heavy glitch lifting).
       * ==================================================================== */
      if (svgWrapRef.current) {
        let scale = 1;
        let tx = 0;
        let ty = 0;
        if (isCustom) {
          const breathe = injectingRef.current ? 1 : 0.45;
          scale = 1 + Math.sin(now / 620) * 0.006 * breathe;
        } else if (collapse > 0 && !reduced) {
          const amp = collapse * 4; // small — physicality, not the main glitch
          tx = (Math.random() - 0.5) * amp;
          ty = (Math.random() - 0.5) * amp;
        }
        const svgT =
          "translate3d(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px,0) scale(" + scale.toFixed(4) + ")";
        if (th.svgT !== svgT) {
          svgWrapRef.current.style.transform = svgT;
          th.svgT = svgT;
        }
      }

      /* ====================================================================
       * F. MAGNETIC BUTTON — JS spring. Lerp current -> target every frame
       *    (frame-rate independent) instead of leaning on a CSS transition.
       * ==================================================================== */
      if (buttonRef.current) {
        const mt = magnetTargetRef.current;
        const mc = magnetCurrentRef.current;
        const sf = 1 - Math.pow(1 - MAGNET_STIFF, dt / 16.667);
        mc.x += (mt.x - mc.x) * sf;
        mc.y += (mt.y - mc.y) * sf;
        // Settle to exact zero once we're home so the loop can fully stop.
        if (!magnetActiveRef.current) {
          if (Math.abs(mc.x) < 0.05) mc.x = 0;
          if (Math.abs(mc.y) < 0.05) mc.y = 0;
        }
        // Press compression while held, straining harder under load/collapse.
        let bScale = 1;
        if (injectingRef.current) {
          bScale = 0.97 - load * 0.03 - (collapse > 0 ? Math.random() * collapse * 0.02 : 0);
        }
        buttonRef.current.style.transform =
          "translate3d(" + mc.x.toFixed(2) + "px," + mc.y.toFixed(2) + "px,0) scale(" + bScale.toFixed(3) + ")";
      }

      /* ====================================================================
       * G. DECODE STEP — advance every in-flight scramble. Bounded work
       *    (<= MAX_ACTIVE_DECODES short strings), all writes, no reads.
       * ==================================================================== */
      const decodes = activeDecodesRef.current;
      if (decodes.length) {
        for (let i = decodes.length - 1; i >= 0; i--) {
          const ln = decodes[i];
          if (!ln || !ln.isConnected) {
            decodes.splice(i, 1); // node was ring-buffered out
            continue;
          }
          const p = (now - ln._start) / DECODE_MS;
          if (p >= 1) {
            ln.textContent = ln._full;
            decodes.splice(i, 1);
            continue;
          }
          const full = ln._full;
          const from = ln._from;
          const len = full.length;
          const reveal = from + Math.floor((len - from) * p);
          let out = full.slice(0, reveal);
          for (let c = reveal; c < len; c++) {
            const ch = full[c];
            out += ch === " " ? " " : SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
          }
          ln.textContent = out;
        }
      }

      /* ====================================================================
       * H. HAPTICS — vibrate proportionally to load while the finger is down.
       *    Interval shrinks + pulse lengthens with load => from light taps to a
       *    near-continuous violent buzz at System Collapse. STANDARD escalates
       *    hard; CUSTOM stays a gentle, capped confirmation tick.
       * ==================================================================== */
      if (
        injectingRef.current &&
        !reduced &&
        load >= 0.08 &&
        typeof navigator !== "undefined" &&
        navigator.vibrate
      ) {
        const e = Math.pow(load, 1.4);
        const interval = isCustom ? lerp(220, 90, e) : lerp(340, 26, e);
        if (now - lastHapticRef.current >= interval) {
          lastHapticRef.current = now;
          const dur = Math.round(isCustom ? lerp(6, 12, e) : lerp(8, 42, e));
          try {
            navigator.vibrate(dur);
          } catch {
            /* vibration is best-effort */
          }
        }
      }

      /* ====================================================================
       * I. TERMINAL LOG EMISSION (throttled).
       * ==================================================================== */
      if (now - lastLogTsRef.current >= LOG_INTERVAL_MS) {
        lastLogTsRef.current = now;
        if (isCustom) {
          if (injectingRef.current && users < USERS_MAX - 50) {
            pushLog(LOGS_CUSTOM_RAMP[(Math.random() * LOGS_CUSTOM_RAMP.length) | 0], "ok");
          } else if (users >= USERS_MAX - 50 && !stableLoggedRef.current) {
            stableLoggedRef.current = true;
            LOGS_CUSTOM_STABLE.forEach((l) => pushLog(l, "ok"));
          }
        } else if (users >= CRITICAL_THRESHOLD) {
          pushLog(LOGS_STANDARD_CRITICAL[(Math.random() * LOGS_STANDARD_CRITICAL.length) | 0], "err");
          if (users >= USERS_MAX - 50 && !collapsedRef.current) {
            collapsedRef.current = true;
            pushLog(">>> SYSTEM COLLAPSED // 0x000000DEAD", "err");
          }
        } else if (users >= WARN_THRESHOLD) {
          pushLog(LOGS_STANDARD_WARN[(Math.random() * LOGS_STANDARD_WARN.length) | 0], "warn");
        }
      }
    },
    [pushLog, FILTER_ID]
  );

  /* A ref that always points at the latest `tick`, so the rAF loop can
   * re-schedule itself without a const referencing its own initializer. */
  const tickRef = useRef(null);

  /* ---------------------------------------------------------------------------
   * tick — the rAF driver. Frame-rate independent exponential interpolation
   * toward the active target (MAX while held, MIN on release). Self-cancels only
   * once EVERYTHING is settled: counter at baseline, magnet home, no decodes.
   * ------------------------------------------------------------------------- */
  const tick = useCallback(
    (now) => {
      rafRef.current = null;
      if (!isVisibleRef.current) return; // SLEEP MODE (off-screen / tab hidden)

      // Delta-time, clamped to avoid huge jumps after a tab-switch stall.
      const dt = Math.min(now - (lastTsRef.current || now), 64);
      lastTsRef.current = now;

      // Normalise smoothing to real elapsed time -> identical easing at any fps.
      const factor = 1 - Math.pow(1 - SMOOTH_BASE, dt / 16.667);
      const target = injectingRef.current ? USERS_MAX : USERS_MIN;
      usersRef.current += (target - usersRef.current) * factor;
      if (Math.abs(target - usersRef.current) < 1) usersRef.current = target;

      renderFrame(now, dt);

      // Keep running while there's ANY live work to do.
      const mc = magnetCurrentRef.current;
      const magnetHome =
        !magnetActiveRef.current && Math.abs(mc.x) < 0.1 && Math.abs(mc.y) < 0.1;
      const settled =
        !injectingRef.current &&
        usersRef.current <= USERS_MIN + 0.5 &&
        magnetHome &&
        activeDecodesRef.current.length === 0;

      if (!settled) {
        rafRef.current = requestAnimationFrame(tickRef.current);
      } else {
        // Back to full idle: reset transient latches.
        lastTsRef.current = 0;
        collapsedRef.current = false;
        stableLoggedRef.current = false;
      }
    },
    [renderFrame]
  );

  /* Keep the self-scheduling ref pointed at the latest tick. */
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  /* ---------------------------------------------------------------------------
   * startLoop — kick the rAF loop if it isn't already running and we're visible.
   * ------------------------------------------------------------------------- */
  const startLoop = useCallback(() => {
    if (rafRef.current == null && isVisibleRef.current) {
      lastTsRef.current = 0; // fresh dt baseline
      rafRef.current = requestAnimationFrame(tickRef.current || tick);
    }
  }, [tick]);

  /* ===========================================================================
   * POINTER HANDLERS — unified for mouse / touch / pen via Pointer Events.
   * ========================================================================= */
  const handleHoldStart = useCallback(
    (e) => {
      e.preventDefault(); // block text-selection / native long-press menus
      try {
        buttonRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        /* pointer capture is best-effort */
      }
      injectingRef.current = true;
      magnetActiveRef.current = true;
      if (btnLabelRef.current) {
        btnLabelRef.current.textContent = "[ INJECTING... RELEASE TO ABORT ]";
      }
      buttonRef.current?.classList.add("is-holding");
      // A short confirmation tap the instant the press registers.
      if (!reducedRef.current && typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch {
          /* ignore */
        }
      }
      startLoop();
    },
    [startLoop]
  );

  const handleHoldEnd = useCallback(
    (e) => {
      if (e) e.preventDefault();
      try {
        if (e && buttonRef.current?.hasPointerCapture?.(e.pointerId)) {
          buttonRef.current.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      injectingRef.current = false;
      magnetActiveRef.current = false;
      magnetTargetRef.current.x = 0; // let the spring glide it home
      magnetTargetRef.current.y = 0;
      if (btnLabelRef.current) {
        btnLabelRef.current.textContent = "[ HOLD TO INJECT TRAFFIC ]";
      }
      buttonRef.current?.classList.remove("is-holding");
      // Cancel any ongoing vibration.
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(0);
        } catch {
          /* ignore */
        }
      }
      startLoop(); // ensure the decay-to-baseline + spring-home animation runs
    },
    [startLoop]
  );

  /* ---------------------------------------------------------------------------
   * handleMagnet — the ONLY geometry read in the component. Runs on pointer-move
   * (event time, not frame time) and WRITES NOTHING: it recovers the button's
   * untransformed centre (rect minus the transform we already applied) and
   * stores a spring target the rAF loop consumes. Skipped on coarse pointers.
   * ------------------------------------------------------------------------- */
  const handleMagnet = useCallback(
    (e) => {
      if (e.pointerType === "touch") return;
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect(); // <-- single batched READ
      const mc = magnetCurrentRef.current;
      const baseX = r.left + r.width / 2 - mc.x; // undo current translate
      const baseY = r.top + r.height / 2 - mc.y;
      magnetTargetRef.current.x = (e.clientX - baseX) * MAGNET_PULL;
      magnetTargetRef.current.y = (e.clientY - baseY) * MAGNET_PULL;
      magnetActiveRef.current = true;
      startLoop();
    },
    [startLoop]
  );

  const handleMagnetEnter = useCallback(
    (e) => {
      if (e.pointerType === "touch") return;
      magnetActiveRef.current = true;
      startLoop();
    },
    [startLoop]
  );

  const handleMagnetLeave = useCallback(() => {
    const btn = buttonRef.current;
    // Don't release mid-hold (pointer capture keeps the press alive).
    if (btn && !btn.classList.contains("is-holding")) {
      magnetActiveRef.current = false;
      magnetTargetRef.current.x = 0;
      magnetTargetRef.current.y = 0;
      startLoop(); // spring back home, then settle
    }
  }, [startLoop]);

  /* ===========================================================================
   * MODE TOGGLE — the one genuine state transition. Resets the whole sim so each
   * architecture is tested from a clean baseline.
   * ========================================================================= */
  const selectMode = useCallback(
    (next) => {
      if (next === modeRef.current) return;
      injectingRef.current = false;
      setMode(next); // the single allowed re-render

      // Imperatively reset the simulation surface.
      usersRef.current = USERS_MIN;
      collapsedRef.current = false;
      stableLoggedRef.current = false;
      themeRef.current = {}; // force every CSS var to re-write next frame
      finalizeDecodes();
      if (terminalRef.current) terminalRef.current.innerHTML = "";
      if (svgWrapRef.current) svgWrapRef.current.style.transform = "";
      if (svgRef.current) svgRef.current.style.filter = "none";
      filterOnRef.current = false;
      magnetTargetRef.current = { x: 0, y: 0 };
      magnetCurrentRef.current = { x: 0, y: 0 };
      if (buttonRef.current) buttonRef.current.style.transform = "";
      if (radioRef.current) radioRef.current.style.opacity = "0";
      if (counterRef.current) counterRef.current.textContent = formatUsers(USERS_MIN);
      if (labelRef.current) {
        labelRef.current.textContent =
          "[ SIMULTANEOUS_USERS: " + formatUsers(USERS_MIN) + " ]";
      }
      if (gaugeFillRef.current) gaugeFillRef.current.style.transform = "scaleX(0)";

      pushLog(
        next === "custom"
          ? "BOOT  >> mounting CUSTOM PYTHON+REACT ARCHITECTURE :: standby"
          : "BOOT  >> mounting STANDARD TEMPLATE (shared host) :: standby",
        next === "custom" ? "ok" : "warn"
      );
      startLoop();
    },
    [pushLog, startLoop, finalizeDecodes]
  );

  /* ===========================================================================
   * MOUNT EFFECT — resolve filter primitives, IntersectionObserver (sleep mode),
   * reduced-motion snapshot, initial paint + mandatory teardown.
   * ========================================================================= */
  useEffect(() => {
    const el = sectionRef.current;

    // Snapshot the motion preference once.
    if (typeof window !== "undefined" && window.matchMedia) {
      reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    // Resolve the live SVG-filter primitive nodes by id (set in the markup).
    if (el) {
      turbRef.current = el.querySelector("#" + FILTER_ID + "-turb");
      dispRef.current = el.querySelector("#" + FILTER_ID + "-disp");
      rOffRef.current = el.querySelector("#" + FILTER_ID + "-r");
      bOffRef.current = el.querySelector("#" + FILTER_ID + "-b");
    }

    // Initial paint of the idle baseline so the panel isn't blank.
    if (counterRef.current) counterRef.current.textContent = formatUsers(USERS_MIN);
    pushLog("SYS   >> diagnostic console ready :: awaiting operator", "warn");

    let observer = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          isVisibleRef.current = entry.isIntersecting;
          if (entry.isIntersecting) {
            // Resume only if there's actual work pending.
            if (
              injectingRef.current ||
              usersRef.current > USERS_MIN + 0.5 ||
              magnetActiveRef.current ||
              activeDecodesRef.current.length > 0
            ) {
              startLoop();
            }
          } else if (rafRef.current != null) {
            // Left view: hard-freeze, and don't leave any line mid-scramble.
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            finalizeDecodes();
          }
        },
        { threshold: 0.15 }
      );
      observer.observe(el);
    }

    // Pause when the browser tab is hidden as well.
    const onVisibility = () => {
      if (document.hidden && rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        finalizeDecodes();
      } else if (
        !document.hidden &&
        isVisibleRef.current &&
        (injectingRef.current ||
          usersRef.current > USERS_MIN + 0.5 ||
          activeDecodesRef.current.length > 0)
      ) {
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Play the intro decode (runs a few frames, then self-settles).
    startLoop();

    // --- TEARDOWN -----------------------------------------------------------
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (observer) observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(0);
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===========================================================================
   * RENDER — static shell only. Everything dynamic is mutated via refs above.
   * ========================================================================= */
  return (
    <section
      ref={sectionRef}
      className="stsim"
      data-mode={mode}
      aria-label="Server stress test simulator"
    >
      {/* All component CSS is inlined for a fully autonomous, drop-in file. */}
      <style>{STRESS_TEST_CSS}</style>

      <div ref={panelRef} className="stsim__panel">
        {/* ---------------- 1. SECTION HEADER ---------------- */}
        <header className="stsim__head">
          <span className="stsim__eyebrow">
            [ SYSTEM_DIAGNOSTIC // STRESS_TEST ]
          </span>
          <h2 className="stsim__title">Simula il sovraccarico.</h2>
        </header>

        {/* ---------------- 2. INFRASTRUCTURE TOGGLE (asymmetric) ---------------- */}
        <div className="stsim__toggle" role="tablist" aria-label="Architettura">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "standard"}
            className={
              "stsim__opt stsim__opt--a" + (mode === "standard" ? " is-active" : "")
            }
            onClick={() => selectMode("standard")}
          >
            <span className="stsim__optTag">OPTION 01</span>
            <span className="stsim__optName">STANDARD TEMPLATE</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "custom"}
            className={
              "stsim__opt stsim__opt--b" + (mode === "custom" ? " is-active" : "")
            }
            onClick={() => selectMode("custom")}
          >
            <span className="stsim__optTag">OPTION 02</span>
            <span className="stsim__optName">CUSTOM PYTHON+REACT ARCHITECTURE</span>
          </button>
        </div>

        {/* ---------------- 3. SERVER CORE (SVG diagram + counter) ---------------- */}
        <div className="stsim__core">
          <div className="stsim__svgCell">
            <span className="stsim__cellTag">[ SERVER_CORE // CLUSTER_VIEW ]</span>
            <div ref={svgWrapRef} className="stsim__svgWrap">
              <ServerDiagram filterId={FILTER_ID} svgRef={svgRef} />
            </div>
          </div>

          <div className="stsim__readout">
            <span ref={labelRef} className="stsim__usersLabel">
              [ SIMULTANEOUS_USERS: 100 ]
            </span>
            <div ref={counterRef} className="stsim__counter">
              100
            </div>
            {/* Load gauge: a 1px-framed bar whose fill is driven via scaleX. */}
            <div className="stsim__gauge" aria-hidden="true">
              <div ref={gaugeFillRef} className="stsim__gaugeFill" />
            </div>
            <span className="stsim__gaugeScale">
              <span>0</span>
              <span>25K</span>
              <span>50K // MAX</span>
            </span>
          </div>
        </div>

        {/* ---------------- 4. MECHANICAL TRIGGER (hold-to-inject) ---------------- */}
        <div className="stsim__triggerRow">
          <button
            ref={buttonRef}
            type="button"
            className="stsim__trigger"
            onPointerDown={handleHoldStart}
            onPointerUp={handleHoldEnd}
            onPointerCancel={handleHoldEnd}
            onPointerEnter={handleMagnetEnter}
            onPointerLeave={handleMagnetLeave}
            onPointerMove={handleMagnet}
            // Hard guarantee against scroll hijack on stubborn mobile browsers.
            onTouchStart={(e) => e.preventDefault()}
            aria-label="Hold to inject traffic"
          >
            <span className="stsim__triggerInner">
              <span ref={btnLabelRef} className="stsim__triggerLabel">
                [ HOLD TO INJECT TRAFFIC ]
              </span>
              <span className="stsim__triggerIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    d="M5 12h12M13 7l5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="square"
                  />
                </svg>
              </span>
            </span>
          </button>
          <p className="stsim__hint">
            Premi e <strong>tieni premuto</strong>. Rilascia per annullare e
            resettare il carico.
          </p>
        </div>

        {/* ---------------- 5. LOG TERMINAL ---------------- */}
        <div className="stsim__termCell">
          <div className="stsim__termBar">
            <span>[ STDOUT // SYSTEM_LOG ]</span>
            <span className="stsim__termDot" aria-hidden="true">
              ● REC
            </span>
          </div>
          <div
            ref={terminalRef}
            className="stsim__terminal"
            role="log"
            aria-live="off"
          />
        </div>

        {/* Screen-blend "radioactive" glow overlay — opacity driven per frame. */}
        <div ref={radioRef} className="stsim__radio" aria-hidden="true" />
      </div>
    </section>
  );
}

/* ===========================================================================
 * ServerDiagram — minimal 1px vector cluster: a central core node linked to
 * four rack modules. Pure stroke geometry (no fills, no radii). Colours inherit
 * `currentColor` so the live theme recolours the entire diagram for free.
 *
 * The <defs> carry the glitch filter:
 *   feTurbulence -> feDisplacementMap   : organic warp (scale driven by JS)
 *   feColorMatrix x3 + feOffset + feBlend(screen) : RGB chromatic aberration
 * ========================================================================= */
function ServerDiagram({ filterId, svgRef }) {
  return (
    <svg
      ref={svgRef}
      className="stsim__svg"
      viewBox="0 0 360 220"
      width="100%"
      role="img"
      aria-label="Server cluster diagram"
    >
      <defs>
        <filter
          id={filterId}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          {/* organic noise field that drives the displacement */}
          <feTurbulence
            id={filterId + "-turb"}
            type="fractalNoise"
            baseFrequency="0.001 0.001"
            numOctaves="2"
            seed="7"
            stitchTiles="stitch"
            result="turb"
          />
          {/* warp the artwork by the noise; `scale` is animated live (0 = off) */}
          <feDisplacementMap
            id={filterId + "-disp"}
            in="SourceGraphic"
            in2="turb"
            scale="0"
            xChannelSelector="R"
            yChannelSelector="G"
            result="src"
          />

          {/* isolate the RED channel and shove it +x */}
          <feColorMatrix
            in="src"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="redCh"
          />
          <feOffset id={filterId + "-r"} in="redCh" dx="0" dy="0" result="redOff" />

          {/* isolate the BLUE channel and shove it -x */}
          <feColorMatrix
            in="src"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="blueCh"
          />
          <feOffset id={filterId + "-b"} in="blueCh" dx="0" dy="0" result="blueOff" />

          {/* keep the GREEN channel anchored */}
          <feColorMatrix
            in="src"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="greenCh"
          />

          {/* screen-recombine the three offset channels -> chromatic fringe */}
          <feBlend in="redOff" in2="greenCh" mode="screen" result="rg" />
          <feBlend in="rg" in2="blueOff" mode="screen" />
        </filter>
      </defs>

      {/* connective bus lines (core <-> racks) */}
      <g
        className="stsim__svgLines"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        vectorEffect="non-scaling-stroke"
      >
        <line x1="180" y1="110" x2="60" y2="48" />
        <line x1="180" y1="110" x2="300" y2="48" />
        <line x1="180" y1="110" x2="60" y2="172" />
        <line x1="180" y1="110" x2="300" y2="172" />
        <line x1="0" y1="110" x2="360" y2="110" strokeDasharray="2 5" />
        <line x1="180" y1="0" x2="180" y2="220" strokeDasharray="2 5" />
      </g>

      {/* four rack modules */}
      <g
        className="stsim__svgRacks"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        vectorEffect="non-scaling-stroke"
      >
        <ServerRack x={24} y={24} />
        <ServerRack x={264} y={24} />
        <ServerRack x={24} y={148} />
        <ServerRack x={264} y={148} />
      </g>

      {/* central core node */}
      <g
        className="stsim__svgCoreNode"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="none"
        vectorEffect="non-scaling-stroke"
      >
        <rect x="150" y="86" width="60" height="48" />
        <line x1="150" y1="98" x2="210" y2="98" />
        <line x1="150" y1="122" x2="210" y2="122" />
        <circle cx="180" cy="110" r="5" />
      </g>

      {/* crosshair registration marks at the grid corners */}
      <g
        className="stsim__svgCross"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
        vectorEffect="non-scaling-stroke"
      >
        <path d="M8 4v8M4 8h8" />
        <path d="M352 4v8M348 8h8" />
        <path d="M8 208v8M4 212h8" />
        <path d="M352 208v8M348 212h8" />
      </g>
    </svg>
  );
}

/* A single 72x48 rack module: outline + three internal "blade" slots. */
function ServerRack({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="72" height="48" />
      <line x1="0" y1="16" x2="72" y2="16" />
      <line x1="0" y1="32" x2="72" y2="32" />
      {/* status LEDs */}
      <circle cx="62" cy="8" r="2" />
      <circle cx="62" cy="24" r="2" />
      <circle cx="62" cy="40" r="2" />
    </g>
  );
}

/* ===========================================================================
 * COMPONENT CSS — fully self-contained, no Tailwind / external utilities.
 * THEMING IS DRIVEN ENTIRELY BY LIVE CSS VARIABLES set per-frame from JS:
 *   --accent  current accent colour (orange -> red, or green)
 *   --fg      foreground/text colour
 *   --glow    accent colour with a load-scaled alpha (for shadows/glows)
 *   --border  panel border colour
 *   --load    0..1 overall load            (drives glow blur/spread)
 *   --collapse 0..1 past-critical severity (drives inset glow + radio overlay)
 *   --core-fill core-node fill tint
 * No threshold CLASSES are toggled at runtime anymore -> no selector re-match,
 * no layout thrash, and colour is a continuous millisecond ramp.
 * ========================================================================= */
const STRESS_TEST_CSS = `

.stsim {
  /* ---- palette (tassativa) ---- */
  --bg:        #030201;
  --cream:     #F0E6D3;
  --grid:      rgba(240,230,211,0.06);
  --grid-soft: rgba(240,230,211,0.10);
  --orange:    #F4A261;
  --green:     #4AF626;
  --red:       #FF3B30;

  position: relative;
  box-sizing: border-box;
  width: 100%;
  background: var(--bg);
  color: var(--cream);
  font-family: 'Space Grotesk', system-ui, sans-serif;
  padding: clamp(48px, 7vw, 120px) clamp(16px, 4vw, 64px);
  /* faint blueprint grid backdrop */
  background-image:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 48px 48px;
}
.stsim *, .stsim *::before, .stsim *::after { box-sizing: border-box; }

/* outer 1px enclosure — all theming flows through these live vars */
.stsim__panel {
  position: relative;
  max-width: 1180px;
  margin: 0 auto;
  overflow: hidden;

  /* live theme tokens (JS overwrites these every frame) */
  --load: 0;
  --collapse: 0;
  --accent: var(--orange);
  --fg: var(--cream);
  --glow: rgba(244,162,97,0);
  --border: rgba(240,230,211,0.10);
  --core-fill: transparent;

  border: 1px solid var(--border);
  background: rgba(3,2,1,0.6);
  /* glow is pure JS-driven; no CSS transition (it would fight the per-frame writes) */
  box-shadow:
    0 0 calc(90px * var(--load)) -22px var(--glow),
    inset 0 0 calc(70px * var(--collapse)) -28px var(--glow);
}

/* ---------- header ---------- */
.stsim__head {
  position: relative;
  z-index: 1;
  padding: clamp(20px, 3vw, 40px);
  border-bottom: 1px solid var(--border);
}
.stsim__eyebrow {
  display: inline-block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: clamp(14px, 2vw, 26px);
}
.stsim__title {
  margin: 0;
  font-weight: 700;
  line-height: 0.92;
  letter-spacing: -0.03em;
  font-size: clamp(2.6rem, 8vw, 6.5rem);
  color: var(--fg);
}

/* ---------- toggle (asymmetric) ---------- */
.stsim__toggle {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1.6fr; /* asymmetric weighting */
  border-bottom: 1px solid var(--border);
}
.stsim__opt {
  appearance: none;
  background: transparent;
  border: 0;
  border-right: 1px solid var(--border);
  color: var(--cream);
  text-align: left;
  padding: clamp(16px, 2.2vw, 26px);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  transition: background 450ms cubic-bezier(0.32,0.72,0,1),
              color 450ms cubic-bezier(0.32,0.72,0,1),
              opacity 450ms cubic-bezier(0.32,0.72,0,1);
  opacity: 0.5;
}
.stsim__opt:last-child { border-right: 0; }
.stsim__opt:hover { opacity: 0.85; background: rgba(240,230,211,0.03); }
.stsim__opt.is-active { opacity: 1; background: rgba(240,230,211,0.05); }
.stsim__opt--a.is-active { box-shadow: inset 3px 0 0 var(--orange); color: var(--orange); }
.stsim__opt--b.is-active { box-shadow: inset 3px 0 0 var(--green); color: var(--green); }
.stsim__optTag { font-size: 10px; letter-spacing: 0.24em; opacity: 0.7; }
.stsim__optName {
  font-size: clamp(0.85rem, 1.4vw, 1.05rem);
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* ---------- server core ---------- */
.stsim__core {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  border-bottom: 1px solid var(--border);
}
.stsim__svgCell {
  position: relative;
  padding: clamp(20px, 3vw, 48px);
  border-right: 1px solid var(--border);
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stsim__cellTag, .stsim__usersLabel {
  position: absolute;
  top: 14px; left: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--accent);
  opacity: 0.8;
}
.stsim__svgWrap {
  width: 100%;
  max-width: 460px;
  will-change: transform;   /* own GPU layer for breathing / shake */
  transform: translateZ(0);
}
.stsim__svg {
  display: block;
  overflow: visible;        /* let the displacement filter bleed past the box */
  color: var(--fg);
  will-change: filter;
}
.stsim__svgCoreNode circle { fill: var(--core-fill); }

/* readout column */
.stsim__readout {
  position: relative;
  padding: clamp(24px, 3vw, 48px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
}
.stsim__usersLabel { position: static; margin-bottom: -6px; }
.stsim__counter {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.02em;
  font-size: clamp(3.2rem, 11vw, 8rem);
  color: var(--fg);
  font-variant-numeric: tabular-nums;
  /* neon glow scales with load, blooming "radioactive" at collapse */
  text-shadow:
    0 0 calc(22px * var(--load)) var(--glow),
    0 0 calc(64px * var(--collapse)) var(--glow);
}
/* 1px-framed load gauge */
.stsim__gauge {
  height: 14px;
  border: 1px solid var(--border);
  background: rgba(240,230,211,0.02);
  overflow: hidden;
}
.stsim__gaugeFill {
  height: 100%;
  width: 100%;
  transform: scaleX(0);
  transform-origin: left center;
  background: var(--accent);
  will-change: transform;
  box-shadow: 0 0 calc(18px * var(--load)) var(--glow);
}
.stsim__gaugeScale {
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  opacity: 0.55;
}

/* ---------- trigger ---------- */
.stsim__triggerRow {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: clamp(16px, 3vw, 40px);
  padding: clamp(28px, 4vw, 56px) clamp(20px, 3vw, 48px);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.stsim__trigger {
  appearance: none;
  border: 1px solid var(--accent);
  background: rgba(240,230,211,0.02);
  color: var(--fg);
  padding: 0;
  cursor: pointer;
  border-radius: 999px;
  touch-action: none;       /* a long-press never scrolls the page */
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  will-change: transform;
  /* NOTE: transform is JS-spring-driven; only non-transform props transition. */
  transition: box-shadow 350ms cubic-bezier(0.32,0.72,0,1),
              border-color 200ms linear,
              background 200ms linear;
}
.stsim__trigger:hover { box-shadow: 0 0 0 6px rgba(240,230,211,0.03); }
.stsim__trigger.is-holding {
  background: var(--accent);
  color: var(--bg);
  box-shadow: 0 0 48px -4px var(--glow);
}
.stsim__triggerInner {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px 14px 26px;
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(0.8rem, 1.4vw, 1rem);
  letter-spacing: 0.08em;
  font-weight: 500;
}
.stsim__triggerLabel { white-space: nowrap; }
.stsim__triggerIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px; height: 30px;
  border-radius: 999px;
  background: rgba(240,230,211,0.08);
  transition: transform 350ms cubic-bezier(0.32,0.72,0,1),
              background 350ms cubic-bezier(0.32,0.72,0,1);
}
.stsim__trigger:hover .stsim__triggerIcon { transform: translate(2px,-1px) scale(1.06); }
.stsim__trigger.is-holding .stsim__triggerIcon { background: rgba(3,2,1,0.25); }
.stsim__hint {
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.04em;
  color: var(--cream);
  opacity: 0.55;
  max-width: 320px;
}
.stsim__hint strong { color: var(--accent); font-weight: 700; }

/* ---------- terminal ---------- */
.stsim__termCell { position: relative; z-index: 1; }
.stsim__termBar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px clamp(20px, 3vw, 48px);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--accent);
  border-bottom: 1px solid var(--border);
}
.stsim__termDot { color: var(--red); animation: stsimBlink 1.4s steps(1) infinite; }
@keyframes stsimBlink { 0%,50%{opacity:1;} 51%,100%{opacity:0.2;} }
.stsim__terminal {
  height: 200px;
  overflow: hidden;
  padding: 14px clamp(20px, 3vw, 48px);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  line-height: 1.5;
  letter-spacing: 0.02em;
  background:
    repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(240,230,211,0.015) 3px, rgba(240,230,211,0.015) 4px);
}
.stsim__logline { white-space: pre-wrap; word-break: break-word; opacity: 0.92; }
.stsim__logline--ok   { color: var(--green); }
.stsim__logline--warn { color: var(--orange); }
.stsim__logline--err  { color: var(--red); }

/* ---------- radioactive glow overlay ----------
 * Screen-blends over the whole panel; opacity is JS-driven (0 when nominal,
 * blooming + flickering as the system approaches collapse). pointer-events:none
 * so it never intercepts clicks. */
.stsim__radio {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  opacity: 0;
  will-change: opacity;
  mix-blend-mode: screen;
  background: radial-gradient(120% 90% at 50% 45%, var(--glow), transparent 72%);
}

/* ===========================================================================
 *  MOBILE COLLAPSE (< 768px) — single column, full-width, no asymmetry.
 * ========================================================================= */
@media (max-width: 768px) {
  .stsim { padding: 48px 16px; }
  .stsim__toggle { grid-template-columns: 1fr; }
  .stsim__opt { border-right: 0; border-bottom: 1px solid var(--border); }
  .stsim__opt:last-child { border-bottom: 0; }
  .stsim__core { grid-template-columns: 1fr; }
  .stsim__svgCell { border-right: 0; border-bottom: 1px solid var(--border); min-height: 220px; }
  .stsim__triggerRow { flex-direction: column; align-items: stretch; }
  .stsim__trigger { width: 100%; }
  .stsim__triggerInner { justify-content: space-between; }
  .stsim__hint { max-width: none; }
  .stsim__terminal { height: 170px; }
}

/* Respect reduced-motion: kill blink + the radioactive overlay entirely.
 * (The JS already disables the glitch filter, scramble and haptics.) */
@media (prefers-reduced-motion: reduce) {
  .stsim__termDot { animation: none; }
  .stsim__radio { display: none; }
}
`;
