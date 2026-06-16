import React, { useRef, useEffect, useState, useCallback } from "react";

/**
 * ============================================================================
 *  StressTestSection.jsx — "IL SIMULATORE DI COLLASSO"
 * ----------------------------------------------------------------------------
 *  Swiss-Cyber Brutalist / High-End Tech interactive panel.
 *
 *  CORE ENGINEERING PHILOSOPHY
 *  ---------------------------
 *  The counter sweeps from 100 -> 50.000 simultaneous users. If we routed
 *  that value through React state at 60fps we would trigger thousands of
 *  reconciliations per hold, tanking the frame budget. Instead:
 *
 *   - The animated quantities (user count, SVG jitter, log throughput, colour
 *     thresholds) live entirely in `useRef` + an imperative requestAnimationFrame
 *     loop. We mutate `textContent`, `transform`, and `classList` DIRECTLY on
 *     DOM nodes. React renders the static shell exactly once.
 *
 *   - React state is reserved ONLY for things that genuinely re-architect the
 *     UI: the infrastructure mode toggle (STANDARD vs CUSTOM). That is a rare,
 *     intentional, user-driven change — cheap to reconcile.
 *
 *   - An IntersectionObserver puts the whole simulator into "sleep mode" when
 *     it scrolls out of view: the rAF loop is cancelled and no listeners fire,
 *     so an idle/off-screen section costs zero CPU.
 *
 *   - All motion is expressed via `transform` and `opacity` ONLY (GPU-safe).
 *     We never animate top/left/width/height. `will-change: transform` is set
 *     only on the nodes that actually move.
 *
 *   - The trigger uses unified Pointer Events with `touch-action: none` so a
 *     long-press on mobile injects traffic WITHOUT scrolling the page.
 *
 *  No external libraries (no GSAP, no Tailwind). A hand-rolled frame-rate
 *  independent interpolator stands in for GSAP's tweening.
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
// We re-normalise it against real delta-time each frame so the curve looks
// identical at 30fps, 60fps or 120fps.
const SMOOTH_BASE = 0.055;

// Throttle for terminal output so logs arrive in readable "bursts", not a
// per-frame firehose.
const LOG_INTERVAL_MS = 110;
const MAX_LOG_LINES = 14; // ring-buffer cap to keep the DOM tiny

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
   * REACT STATE — intentionally minimal.
   * `mode` is the ONLY value allowed to trigger a re-render. Everything that
   * animates is held in refs below.
   * ========================================================================= */
  const [mode, setMode] = useState("standard"); // "standard" | "custom"

  /* ===========================================================================
   * DOM REFS — the imperative animation surface.
   * ========================================================================= */
  const sectionRef = useRef(null); // IntersectionObserver target / root
  const panelRef = useRef(null); // receives state classes (warning/critical/custom)
  const counterRef = useRef(null); // the giant monospace number node
  const labelRef = useRef(null); // the "[ SIMULTANEOUS_USERS: N ]" badge node
  const svgWrapRef = useRef(null); // SVG container we jitter via transform
  const gaugeFillRef = useRef(null); // load-bar fill (scaleX)
  const buttonRef = useRef(null); // magnetic hold button
  const btnLabelRef = useRef(null); // button caption (text swaps on hold)
  const terminalRef = useRef(null); // log scroll container

  /* ===========================================================================
   * MUTABLE SIMULATION STATE — refs so updates never re-render.
   * ========================================================================= */
  const usersRef = useRef(USERS_MIN); // current interpolated user count
  const injectingRef = useRef(false); // is the button currently held?
  const modeRef = useRef(mode); // mirror of `mode` readable inside rAF
  const rafRef = useRef(null); // active animation frame id (or null)
  const lastTsRef = useRef(0); // timestamp of previous frame (for dt)
  const lastLogTsRef = useRef(0); // timestamp of last emitted log line
  const isVisibleRef = useRef(true); // IntersectionObserver visibility flag
  const stateClassRef = useRef(""); // last applied threshold class (dedupe)
  const collapsedRef = useRef(false); // STANDARD: latched "SYSTEM COLLAPSED" log
  const stableLoggedRef = useRef(false); // CUSTOM: latched "200 OK" log

  /* Keep the ref mirror of `mode` in sync so the rAF loop reads fresh values. */
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  /* ---------------------------------------------------------------------------
   * formatUsers — thousands-separated integer, e.g. 50000 -> "50,000".
   * Pure string work; no allocation-heavy Intl in the hot path.
   * ------------------------------------------------------------------------- */
  const formatUsers = (n) => {
    const v = Math.round(n);
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  /* ---------------------------------------------------------------------------
   * pushLog — append a single line to the terminal as a real DOM node, then
   * enforce the ring-buffer cap and pin scroll to the bottom. Operates outside
   * React entirely.
   * ------------------------------------------------------------------------- */
  const pushLog = useCallback((text, kind) => {
    const term = terminalRef.current;
    if (!term) return;

    const line = document.createElement("div");
    line.className = "stsim__logline stsim__logline--" + kind;

    // Prefix every line with a faux millisecond clock for telemetry flavour.
    const clock = (performance.now() % 100000).toFixed(0).padStart(5, "0");
    line.textContent = "[" + clock + "ms] " + text;

    term.appendChild(line);

    // Ring-buffer: drop the oldest node(s) once we exceed the cap. Removing
    // from the front keeps DOM size bounded => stable memory + layout cost.
    while (term.childElementCount > MAX_LOG_LINES) {
      term.removeChild(term.firstElementChild);
    }
    // Keep the newest line in view.
    term.scrollTop = term.scrollHeight;
  }, []);

  /* ---------------------------------------------------------------------------
   * applyStateClass — flip the panel's threshold class at most once per change.
   * Drives all colour theming through CSS rather than per-frame style writes.
   * ------------------------------------------------------------------------- */
  const applyStateClass = useCallback((next) => {
    if (stateClassRef.current === next) return; // dedupe: no redundant writes
    const panel = panelRef.current;
    if (!panel) return;
    panel.classList.remove(
      "is-nominal",
      "is-warning",
      "is-critical",
      "is-custom-stable"
    );
    panel.classList.add(next);
    stateClassRef.current = next;
  }, []);

  /* ---------------------------------------------------------------------------
   * renderFrame — the single imperative paint. Called every rAF tick. Reads
   * `usersRef` and writes directly to the DOM. NEVER calls setState.
   * ------------------------------------------------------------------------- */
  const renderFrame = useCallback(
    (now) => {
      const users = usersRef.current;
      const isCustom = modeRef.current === "custom";

      /* --- 1. The giant counter + telemetry badge --------------------------- */
      if (counterRef.current) {
        counterRef.current.textContent = formatUsers(users);
      }
      if (labelRef.current) {
        labelRef.current.textContent =
          "[ SIMULTANEOUS_USERS: " + formatUsers(users) + " ]";
      }

      /* --- 2. Load gauge (scaleX 0..1) — transform-only, GPU friendly ------- */
      if (gaugeFillRef.current) {
        const pct = (users - USERS_MIN) / (USERS_MAX - USERS_MIN); // 0..1
        gaugeFillRef.current.style.transform = "scaleX(" + pct.toFixed(4) + ")";
      }

      /* --- 3. Threshold / colour state machine ------------------------------ */
      if (isCustom) {
        // CUSTOM ARCHITECTURE: always healthy. Near saturation we latch the
        // "stable" theme (full neon green glow). Below that it's nominal-custom.
        applyStateClass("is-custom-stable");
      } else {
        // STANDARD TEMPLATE: degrade as load climbs.
        if (users >= CRITICAL_THRESHOLD) applyStateClass("is-critical");
        else if (users >= WARN_THRESHOLD) applyStateClass("is-warning");
        else applyStateClass("is-nominal");
      }

      /* --- 4. SVG kinetic behaviour (transform-only jitter / pulse) --------- */
      if (svgWrapRef.current) {
        let tx = 0;
        let ty = 0;
        let rot = 0;
        let scale = 1;

        if (isCustom) {
          // Soft harmonic breathing pulse — sine-driven, sub-pixel, serene.
          const breathe = injectingRef.current ? 1 : 0.45;
          scale = 1 + Math.sin(now / 620) * 0.006 * breathe;
        } else {
          // Compute how far past each threshold we are => jitter magnitude.
          if (users >= WARN_THRESHOLD) {
            // Ramp 0..1 across the warning band, then keep growing into crit.
            const warnSpan = CRITICAL_THRESHOLD - WARN_THRESHOLD;
            const warnAmt = Math.min(1, (users - WARN_THRESHOLD) / warnSpan);
            let amp = 1.5 + warnAmt * 3.5; // gentle shudder in the warn zone

            if (users >= CRITICAL_THRESHOLD) {
              // Violent collapse: amplitude scales with overshoot past crit.
              const critSpan = USERS_MAX - CRITICAL_THRESHOLD;
              const critAmt = Math.min(1, (users - CRITICAL_THRESHOLD) / critSpan);
              amp = 6 + critAmt * 12; // up to ~18px of chaos
              rot = (Math.random() - 0.5) * critAmt * 2.4; // glitch rotation
            }
            // Random walk each frame => raw mechanical vibration.
            tx = (Math.random() - 0.5) * amp;
            ty = (Math.random() - 0.5) * amp;
          }
        }

        // Single composited transform write (translate3d => own GPU layer).
        svgWrapRef.current.style.transform =
          "translate3d(" +
          tx.toFixed(2) +
          "px," +
          ty.toFixed(2) +
          "px,0) rotate(" +
          rot.toFixed(3) +
          "deg) scale(" +
          scale.toFixed(4) +
          ")";
      }

      /* --- 5. Terminal log emission (throttled) ----------------------------- */
      if (now - lastLogTsRef.current >= LOG_INTERVAL_MS) {
        lastLogTsRef.current = now;

        if (isCustom) {
          if (injectingRef.current && users < USERS_MAX - 50) {
            pushLog(
              LOGS_CUSTOM_RAMP[(Math.random() * LOGS_CUSTOM_RAMP.length) | 0],
              "ok"
            );
          } else if (users >= USERS_MAX - 50) {
            // Latch a couple of definitive "all good" lines at saturation.
            if (!stableLoggedRef.current) {
              stableLoggedRef.current = true;
              LOGS_CUSTOM_STABLE.forEach((l) => pushLog(l, "ok"));
            }
          }
        } else {
          if (users >= CRITICAL_THRESHOLD) {
            pushLog(
              LOGS_STANDARD_CRITICAL[
                (Math.random() * LOGS_STANDARD_CRITICAL.length) | 0
              ],
              "err"
            );
            // Latch the final collapse line once we hit saturation.
            if (users >= USERS_MAX - 50 && !collapsedRef.current) {
              collapsedRef.current = true;
              pushLog(">>> SYSTEM COLLAPSED // 0x000000DEAD", "err");
            }
          } else if (users >= WARN_THRESHOLD) {
            pushLog(
              LOGS_STANDARD_WARN[(Math.random() * LOGS_STANDARD_WARN.length) | 0],
              "warn"
            );
          }
        }
      }
    },
    [applyStateClass, pushLog]
  );

  /* ---------------------------------------------------------------------------
   * tick — the rAF driver. Frame-rate independent exponential interpolation
   * toward the active target (MAX while held, MIN on release). Self-cancels
   * when idle or off-screen so we never burn cycles needlessly.
   * ------------------------------------------------------------------------- */
  const tick = useCallback(
    (now) => {
      rafRef.current = null;

      // SLEEP MODE: if scrolled out of view, freeze. The IntersectionObserver
      // will restart the loop when the section returns.
      if (!isVisibleRef.current) return;

      // Delta-time in ms, clamped to avoid huge jumps after a tab-switch stall.
      const dt = Math.min(now - (lastTsRef.current || now), 64);
      lastTsRef.current = now;

      // Normalise the smoothing factor to real elapsed time so the easing
      // looks identical regardless of refresh rate.
      const factor = 1 - Math.pow(1 - SMOOTH_BASE, dt / 16.667);

      const target = injectingRef.current ? USERS_MAX : USERS_MIN;
      usersRef.current += (target - usersRef.current) * factor;

      // Snap when within 1 user of target to settle cleanly.
      if (Math.abs(target - usersRef.current) < 1) usersRef.current = target;

      renderFrame(now);

      // Continue while holding, or while still decaying back to baseline.
      const settled = !injectingRef.current && usersRef.current <= USERS_MIN + 0.5;
      if (!settled) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Fully reset transient latches once we're back at idle baseline.
        lastTsRef.current = 0;
        collapsedRef.current = false;
        stableLoggedRef.current = false;
      }
    },
    [renderFrame]
  );

  /* ---------------------------------------------------------------------------
   * startLoop — kick the rAF loop if it isn't already running and we're visible.
   * Guarded so multiple pointer events can't stack duplicate loops.
   * ------------------------------------------------------------------------- */
  const startLoop = useCallback(() => {
    if (rafRef.current == null && isVisibleRef.current) {
      lastTsRef.current = 0; // fresh dt baseline
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  /* ===========================================================================
   * POINTER HANDLERS — unified for mouse / touch / pen via Pointer Events.
   * `touch-action: none` (CSS) + pointer capture stops mobile scroll-stealing
   * while the user holds the trigger.
   * ========================================================================= */
  const handleHoldStart = useCallback(
    (e) => {
      e.preventDefault(); // block text-selection / native long-press menus
      // Capture the pointer so we still receive the "up" even if the finger
      // drifts off the button edge.
      try {
        buttonRef.current?.setPointerCapture?.(e.pointerId);
      } catch (_) {
        /* pointer capture is best-effort */
      }
      injectingRef.current = true;
      if (btnLabelRef.current) {
        btnLabelRef.current.textContent = "[ INJECTING... RELEASE TO ABORT ]";
      }
      buttonRef.current?.classList.add("is-holding");
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
      } catch (_) {
        /* ignore */
      }
      injectingRef.current = false;
      if (btnLabelRef.current) {
        btnLabelRef.current.textContent = "[ HOLD TO INJECT TRAFFIC ]";
      }
      buttonRef.current?.classList.remove("is-holding");
      // Reset magnetic offset so the button glides home.
      if (buttonRef.current) buttonRef.current.style.transform = "";
      startLoop(); // ensure the decay-to-baseline animation runs
    },
    [startLoop]
  );

  /* ---------------------------------------------------------------------------
   * handleMagnet — subtle magnetic pull toward the cursor while hovering.
   * Pure transform write; skipped entirely on coarse pointers (touch) where it
   * has no meaning and could fight the scroll.
   * ------------------------------------------------------------------------- */
  const handleMagnet = useCallback((e) => {
    if (e.pointerType === "touch") return;
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const mx = e.clientX - (r.left + r.width / 2);
    const my = e.clientY - (r.top + r.height / 2);
    // Dampen the pull to ~22% of cursor offset for a magnetic, not jumpy, feel.
    const press = btn.classList.contains("is-holding") ? 0.97 : 1;
    btn.style.transform =
      "translate(" +
      (mx * 0.22).toFixed(2) +
      "px," +
      (my * 0.22).toFixed(2) +
      "px) scale(" +
      press +
      ")";
  }, []);

  const handleMagnetLeave = useCallback(() => {
    const btn = buttonRef.current;
    // Don't snap home mid-hold (pointercapture keeps the press alive).
    if (btn && !btn.classList.contains("is-holding")) btn.style.transform = "";
  }, []);

  /* ===========================================================================
   * MODE TOGGLE — the one genuine state transition. Resets the whole sim so
   * each architecture is tested from a clean baseline.
   * ========================================================================= */
  const selectMode = useCallback(
    (next) => {
      if (next === modeRef.current) return;
      // Abort any in-flight hold.
      injectingRef.current = false;
      setMode(next); // triggers the single allowed re-render

      // Imperatively reset the simulation surface.
      usersRef.current = USERS_MIN;
      collapsedRef.current = false;
      stableLoggedRef.current = false;
      stateClassRef.current = ""; // force re-apply next frame
      if (terminalRef.current) terminalRef.current.innerHTML = "";
      if (svgWrapRef.current) svgWrapRef.current.style.transform = "";
      if (counterRef.current) counterRef.current.textContent = formatUsers(USERS_MIN);
      if (labelRef.current) {
        labelRef.current.textContent =
          "[ SIMULTANEOUS_USERS: " + formatUsers(USERS_MIN) + " ]";
      }
      if (gaugeFillRef.current) gaugeFillRef.current.style.transform = "scaleX(0)";

      // Seed an intro log so the terminal isn't empty after a reset.
      pushLog(
        next === "custom"
          ? "BOOT  >> mounting CUSTOM PYTHON+REACT ARCHITECTURE :: standby"
          : "BOOT  >> mounting STANDARD TEMPLATE (shared host) :: standby",
        next === "custom" ? "ok" : "warn"
      );
      // Paint one frame so colours/gauge settle immediately.
      startLoop();
    },
    [pushLog, startLoop]
  );

  /* ===========================================================================
   * MOUNT EFFECT — IntersectionObserver (sleep mode) + initial paint + the
   * mandatory teardown that cancels rAF and disconnects observers.
   * ========================================================================= */
  useEffect(() => {
    const el = sectionRef.current;

    // Initial paint of the idle baseline so the panel isn't blank pre-interaction.
    if (counterRef.current) counterRef.current.textContent = formatUsers(USERS_MIN);
    applyStateClass("is-nominal");
    pushLog("SYS   >> diagnostic console ready :: awaiting operator", "warn");

    let observer = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          isVisibleRef.current = entry.isIntersecting;
          if (entry.isIntersecting) {
            // Returned to view: resume the loop only if there's work to do.
            if (injectingRef.current || usersRef.current > USERS_MIN + 0.5) {
              startLoop();
            }
          } else if (rafRef.current != null) {
            // Left view: hard-freeze. No frames, no work.
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        },
        { threshold: 0.15 }
      );
      observer.observe(el);
    }

    // Pause when the browser tab is hidden as well (belt-and-suspenders).
    const onVisibility = () => {
      if (document.hidden && rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else if (
        !document.hidden &&
        isVisibleRef.current &&
        (injectingRef.current || usersRef.current > USERS_MIN + 0.5)
      ) {
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // --- TEARDOWN -----------------------------------------------------------
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (observer) observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
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
              "stsim__opt stsim__opt--a" +
              (mode === "standard" ? " is-active" : "")
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
              "stsim__opt stsim__opt--b" +
              (mode === "custom" ? " is-active" : "")
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
              <ServerDiagram />
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
            // Unified pointer events cover mouse + touch + pen.
            onPointerDown={handleHoldStart}
            onPointerUp={handleHoldEnd}
            onPointerCancel={handleHoldEnd}
            onPointerLeave={handleMagnetLeave}
            onPointerMove={handleMagnet}
            // Also bind raw touch handlers as a hard guarantee against scroll
            // hijack on stubborn mobile browsers (preventDefault on touchstart).
            onTouchStart={(e) => e.preventDefault()}
            aria-label="Hold to inject traffic"
          >
            <span className="stsim__triggerInner">
              <span ref={btnLabelRef} className="stsim__triggerLabel">
                [ HOLD TO INJECT TRAFFIC ]
              </span>
              {/* Button-in-button trailing glyph in its own circular wrapper. */}
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
      </div>
    </section>
  );
}

/* ===========================================================================
 * ServerDiagram — minimal 1px vector cluster: a central core node linked to
 * four rack modules. Pure stroke geometry (no fills, no radii) to match the
 * Swiss-brutalist blueprint aesthetic. Colours inherit `currentColor` so the
 * panel's threshold classes recolour the entire diagram for free.
 * ========================================================================= */
function ServerDiagram() {
  return (
    <svg
      className="stsim__svg"
      viewBox="0 0 360 220"
      width="100%"
      role="img"
      aria-label="Server cluster diagram"
    >
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
 * Threshold theming is driven by `.is-nominal | .is-warning | .is-critical |
 * .is-custom-stable` classes toggled imperatively on `.stsim__panel`.
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

  /* live theme tokens — recoloured by the state classes below */
  --fg: var(--cream);
  --accent: var(--orange);
  --glow: rgba(244,162,97,0.0);

  position: relative;
  box-sizing: border-box;
  width: 100%;
  background: var(--bg);
  color: var(--fg);
  font-family: 'Space Grotesk', system-ui, sans-serif;
  padding: clamp(48px, 7vw, 120px) clamp(16px, 4vw, 64px);
  /* faint blueprint grid backdrop */
  background-image:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 48px 48px;
}
.stsim *, .stsim *::before, .stsim *::after { box-sizing: border-box; }

/* outer 1px enclosure */
.stsim__panel {
  position: relative;
  max-width: 1180px;
  margin: 0 auto;
  border: 1px solid var(--grid-soft);
  background: rgba(3,2,1,0.6);
  transition: box-shadow 600ms cubic-bezier(0.32,0.72,0,1),
              border-color 600ms cubic-bezier(0.32,0.72,0,1);
}

/* ---------- header ---------- */
.stsim__head {
  padding: clamp(20px, 3vw, 40px);
  border-bottom: 1px solid var(--grid-soft);
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
  text-transform: none;
  font-size: clamp(2.6rem, 8vw, 6.5rem);
  color: var(--fg);
  transition: color 500ms cubic-bezier(0.32,0.72,0,1);
}

/* ---------- toggle (asymmetric) ---------- */
.stsim__toggle {
  display: grid;
  grid-template-columns: 1fr 1.6fr; /* asymmetric weighting */
  border-bottom: 1px solid var(--grid-soft);
}
.stsim__opt {
  appearance: none;
  background: transparent;
  border: 0;
  border-right: 1px solid var(--grid-soft);
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
.stsim__optTag {
  font-size: 10px;
  letter-spacing: 0.24em;
  opacity: 0.7;
}
.stsim__optName {
  font-size: clamp(0.85rem, 1.4vw, 1.05rem);
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* ---------- server core ---------- */
.stsim__core {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  border-bottom: 1px solid var(--grid-soft);
}
.stsim__svgCell {
  position: relative;
  padding: clamp(20px, 3vw, 48px);
  border-right: 1px solid var(--grid-soft);
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
  will-change: transform; /* promote to its own GPU layer for jitter */
  transform: translateZ(0);
}
.stsim__svg { display: block; color: var(--fg); transition: color 400ms cubic-bezier(0.32,0.72,0,1); }
.stsim__svgCoreNode circle { transition: fill 400ms ease; }

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
  transition: color 350ms cubic-bezier(0.32,0.72,0,1),
              text-shadow 350ms cubic-bezier(0.32,0.72,0,1);
}
/* 1px-framed load gauge */
.stsim__gauge {
  height: 14px;
  border: 1px solid var(--grid-soft);
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
  transition: background 350ms cubic-bezier(0.32,0.72,0,1);
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
  display: flex;
  align-items: center;
  gap: clamp(16px, 3vw, 40px);
  padding: clamp(28px, 4vw, 56px) clamp(20px, 3vw, 48px);
  border-bottom: 1px solid var(--grid-soft);
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
  /* CRITICAL: isolate touch so a long-press never scrolls the page. */
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  will-change: transform;
  transition: transform 350ms cubic-bezier(0.32,0.72,0,1),
              border-color 350ms cubic-bezier(0.32,0.72,0,1),
              box-shadow 350ms cubic-bezier(0.32,0.72,0,1),
              background 350ms cubic-bezier(0.32,0.72,0,1);
}
.stsim__trigger:hover { box-shadow: 0 0 0 6px rgba(240,230,211,0.03); }
.stsim__trigger.is-holding {
  background: var(--accent);
  color: var(--bg);
  box-shadow: 0 0 40px -4px var(--glow);
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
/* button-in-button trailing icon */
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
.stsim__termBar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px clamp(20px, 3vw, 48px);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--accent);
  border-bottom: 1px solid var(--grid-soft);
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

/* ===========================================================================
 *  STATE THEMES — toggled imperatively on .stsim__panel
 * ========================================================================= */

/* STANDARD :: nominal (under load threshold) — calm cream/orange */
.stsim__panel.is-nominal { --fg: var(--cream); --accent: var(--orange); --glow: rgba(244,162,97,0.35); }

/* STANDARD :: warning (>5k) — orange-tinged, panel begins to flag */
.stsim__panel.is-warning {
  --fg: var(--cream); --accent: var(--orange); --glow: rgba(244,162,97,0.5);
  border-color: rgba(244,162,97,0.25);
}

/* STANDARD :: critical (>20k) — full error red + collapse glow */
.stsim__panel.is-critical {
  --fg: var(--red); --accent: var(--red); --glow: rgba(255,59,48,0.6);
  border-color: rgba(255,59,48,0.55);
  box-shadow: 0 0 80px -20px rgba(255,59,48,0.45), inset 0 0 60px -30px rgba(255,59,48,0.4);
  animation: stsimCrtFlicker 220ms steps(2) infinite;
}
.stsim__panel.is-critical .stsim__counter { text-shadow: 0 0 18px rgba(255,59,48,0.6); }
@keyframes stsimCrtFlicker { 0%{opacity:1;} 50%{opacity:0.94;} 100%{opacity:1;} }

/* CUSTOM :: stable — brilliant neon green with soft glow, perfectly steady */
.stsim__panel.is-custom-stable {
  --fg: var(--green); --accent: var(--green); --glow: rgba(74,246,38,0.55);
  border-color: rgba(74,246,38,0.4);
  box-shadow: 0 0 90px -28px rgba(74,246,38,0.4), inset 0 0 50px -34px rgba(74,246,38,0.35);
}
.stsim__panel.is-custom-stable .stsim__counter { text-shadow: 0 0 16px rgba(74,246,38,0.45); }
.stsim__panel.is-custom-stable .stsim__svgCoreNode circle { fill: rgba(74,246,38,0.18); }

/* ===========================================================================
 *  MOBILE COLLAPSE (< 768px) — single column, full-width, no asymmetry.
 * ========================================================================= */
@media (max-width: 768px) {
  .stsim { padding: 48px 16px; }
  .stsim__toggle { grid-template-columns: 1fr; } /* reset asymmetric grid */
  .stsim__opt { border-right: 0; border-bottom: 1px solid var(--grid-soft); }
  .stsim__opt:last-child { border-bottom: 0; }
  .stsim__core { grid-template-columns: 1fr; } /* stack server + readout */
  .stsim__svgCell { border-right: 0; border-bottom: 1px solid var(--grid-soft); min-height: 220px; }
  .stsim__triggerRow { flex-direction: column; align-items: stretch; }
  .stsim__trigger { width: 100%; }
  .stsim__triggerInner { justify-content: space-between; }
  .stsim__hint { max-width: none; }
  .stsim__terminal { height: 170px; }
}

/* Respect reduced-motion: kill the flicker/blink for sensitive users. */
@media (prefers-reduced-motion: reduce) {
  .stsim__panel.is-critical { animation: none; }
  .stsim__termDot { animation: none; }
  .stsim__panel, .stsim__trigger, .stsim__opt, .stsim__title, .stsim__counter { transition-duration: 0.001ms; }
}
`;