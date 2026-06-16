/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  HAUTE HORLOGERIE — ScrubbingWatchHero
 *  Scroll-bound Canvas Image Sequence Scrubbing (240 High-Res frames)
 *
 *  · Canvas rendering w/ devicePixelRatio scaling + "object-fit: contain" math
 *  · GSAP ScrollTrigger pinned for 650vh, scrub-synced to frame index
 *  · gsap.context() for React-safe cleanup
 *  · Scroll-storytelling overlays choreographed on the same timeline
 *  · Magnetic CTA, frame telemetry HUD, prioritized image preloading
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link } from "react-router-dom";

gsap.registerPlugin(ScrollTrigger);

const FRAME_COUNT = 240; //[cite: 3]
const SCRUB_LENGTH = "+=650%"; // pin duration[cite: 3]

// Rilevamento automatico per caricare i frame verticali o orizzontali[cite: 3]
const isMobile = window.innerWidth <= 768; //[cite: 3]
const FRAME_FOLDER = isMobile ? '/camera-frames-mobile' : '/camera-frames'; //[cite: 3]

const framePath = (index) =>
  `${FRAME_FOLDER}/ezgif-frame-${String(index + 1).padStart(3, "0")}.jpg`; //[cite: 3]

export default function ScrubbingWatchHero() {
  const sectionRef = useRef(null); //[cite: 3]
  const canvasRef = useRef(null); //[cite: 3]

  // Overlay refs[cite: 3]
  const titleBlockRef = useRef(null);
  const opticsBlockRef = useRef(null);
  const ctaBlockRef = useRef(null);
  const scrollHintRef = useRef(null);
  const hudFrameRef = useRef(null);
  const hudBarRef = useRef(null);
  const loaderRef = useRef(null);
  const loaderPctRef = useRef(null);
  const ctaButtonRef = useRef(null);

  // Mutable render state (never triggers React re-renders)[cite: 3]
  const imagesRef = useRef([]); //[cite: 3]
  const playheadRef = useRef({ frame: 0 }); //[cite: 3]
  const sizeRef = useRef({ w: 0, h: 0 }); //[cite: 3]

  useEffect(() => {
    const canvas = canvasRef.current; //[cite: 3]
    const ctx = canvas.getContext("2d"); //[cite: 3]

    /* ─────────────────────────────────────────────
       CANVAS — DPR-aware sizing[cite: 3]
    ───────────────────────────────────────────── */
    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2 for perf[cite: 3]
      const w = canvas.clientWidth; //[cite: 3]
      const h = canvas.clientHeight; //[cite: 3]
      canvas.width = Math.round(w * dpr); //[cite: 3]
      canvas.height = Math.round(h * dpr); //[cite: 3]
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); //[cite: 3]

      // Anti-aliasing per dettagli perfetti sui micro-ingranaggi[cite: 3]
      ctx.imageSmoothingEnabled = true; //[cite: 3]
      ctx.imageSmoothingQuality = 'high'; //[cite: 3]
      
      sizeRef.current = { w, h }; //[cite: 3]
      renderFrame(); // repaint immediately — zero flicker on resize[cite: 3]
    };

    /* ─────────────────────────────────────────────
       RENDER — "object-fit: contain" via drawImage math.[cite: 3]
    ───────────────────────────────────────────── */
    const renderFrame = () => {
      const i = Math.round(playheadRef.current.frame); //[cite: 3]
      const img = imagesRef.current[i]; //[cite: 3]
      if (!img || !img.complete || !img.naturalWidth) return; //[cite: 3]

      const { w, h } = sizeRef.current; //[cite: 3]
      const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight); //[cite: 3]
      const dw = img.naturalWidth * scale; //[cite: 3]
      const dh = img.naturalHeight * scale; //[cite: 3]
      const dx = (w - dw) / 2; //[cite: 3]
      const dy = (h - dh) / 2; //[cite: 3]

      ctx.clearRect(0, 0, w, h); //[cite: 3]
      ctx.drawImage(img, dx, dy, dw, dh); //[cite: 3]

      if (hudFrameRef.current) { //[cite: 3]
        hudFrameRef.current.textContent = `CALIBRE 7X — FR ${String(i + 1).padStart( //[cite: 3]
          3,
          "0"
        )} / ${FRAME_COUNT}`; //[cite: 3]
      }
      if (hudBarRef.current) { //[cite: 3]
        hudBarRef.current.style.transform = `scaleX(${ //[cite: 3]
          (i + 1) / FRAME_COUNT //[cite: 3]
        })`;
      }
    };

    /* ─────────────────────────────────────────────
       PRELOAD — prioritized streaming[cite: 3]
    ───────────────────────────────────────────── */
    let settled = 0; //[cite: 3]
    const onSettle = () => {
      settled += 1; //[cite: 3]
      const pct = Math.round((settled / FRAME_COUNT) * 100); //[cite: 3]
      if (loaderPctRef.current) { //[cite: 3]
        loaderPctRef.current.textContent = `ASSEMBLING CALIBRE — ${pct}%`; //[cite: 3]
      }
      if (settled === FRAME_COUNT && loaderRef.current) { //[cite: 3]
        gsap.to(loaderRef.current, { //[cite: 3]
          autoAlpha: 0, //[cite: 3]
          duration: 1.2,
          ease: "power2.out", //[cite: 3]
        });
        ScrollTrigger.refresh(); //[cite: 3]
      }
    };

    for (let i = 0; i < FRAME_COUNT; i++) { //[cite: 3]
      const img = new Image(); //[cite: 3]
      img.decoding = "async"; //[cite: 3]
      if ("fetchPriority" in img) img.fetchPriority = i < 12 ? "high" : "low"; //[cite: 3]
      img.onload = () => { //[cite: 3]
        if (i === 0) renderFrame(); //[cite: 3]
        onSettle(); //[cite: 3]
      };
      img.onerror = onSettle; //[cite: 3]
      img.src = framePath(i); //[cite: 3]
      imagesRef.current[i] = img; //[cite: 3]
    }

    resizeCanvas(); //[cite: 3]
    window.addEventListener("resize", resizeCanvas); //[cite: 3]

    /* ─────────────────────────────────────────────
       MAGNETIC CTA — pointer-tracked spring physics[cite: 3]
    ───────────────────────────────────────────── */
    const btn = ctaButtonRef.current; //[cite: 3]
    const magnetX = gsap.quickTo(btn, "x", { duration: 0.6, ease: "power3" }); //[cite: 3]
    const magnetY = gsap.quickTo(btn, "y", { duration: 0.6, ease: "power3" }); //[cite: 3]

    const onBtnMove = (e) => {
      const r = btn.getBoundingClientRect(); //[cite: 3]
      magnetX((e.clientX - (r.left + r.width / 2)) * 0.25); // Movimento più elegante e pesante
      magnetY((e.clientY - (r.top + r.height / 2)) * 0.25);
    };
    const onBtnLeave = () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.5)" }); //[cite: 3]
    };
    btn.addEventListener("pointermove", onBtnMove); //[cite: 3]
    btn.addEventListener("pointerleave", onBtnLeave); //[cite: 3]

    /* ─────────────────────────────────────────────
       GSAP CONTEXT — timeline + ScrollTrigger[cite: 3]
    ───────────────────────────────────────────── */
    const gsapCtx = gsap.context(() => { //[cite: 3]
      gsap.set([opticsBlockRef.current, ctaBlockRef.current], { //[cite: 3]
        autoAlpha: 0, //[cite: 3]
      });
      gsap.set(titleBlockRef.current, { autoAlpha: 1 }); //[cite: 3]

      const tl = gsap.timeline({ //[cite: 3]
        defaults: { ease: "none" }, //[cite: 3]
        scrollTrigger: { //[cite: 3]
          trigger: sectionRef.current, //[cite: 3]
          start: "top top", //[cite: 3]
          end: SCRUB_LENGTH, //[cite: 3]
          pin: true, //[cite: 3]
          scrub: 1.2, //[cite: 3]
          anticipatePin: 1, //[cite: 3]
          invalidateOnRefresh: true, //[cite: 3]
        },
      });

      /* ── CANVAS SCRUB · 0% → 100% ───────────── */
      tl.to(
        playheadRef.current, //[cite: 3]
        {
          frame: FRAME_COUNT - 1, //[cite: 3]
          duration: 100, //[cite: 3]
          snap: "frame", //[cite: 3]
          onUpdate: renderFrame, //[cite: 3]
        },
        0 //[cite: 3]
      );

      /* ── ACT I · 0–20% ──── */
      tl.to(
        titleBlockRef.current, //[cite: 3]
        { yPercent: -15, duration: 20, ease: "none" }, //[cite: 3]
        0 //[cite: 3]
      );
      tl.to(
        titleBlockRef.current, //[cite: 3]
        {
          autoAlpha: 0, //[cite: 3]
          filter: "blur(12px)", //[cite: 3]
          duration: 10,
          ease: "power2.in", //[cite: 3]
        },
        16 //[cite: 3]
      );

      tl.to(scrollHintRef.current, { autoAlpha: 0, duration: 5 }, 1); //[cite: 3]

      /* ── ACT II · 30–60% ── */
      tl.fromTo(
        opticsBlockRef.current, //[cite: 3]
        { autoAlpha: 0, y: 50, filter: "blur(15px)" },
        {
          autoAlpha: 1, //[cite: 3]
          y: 0, //[cite: 3]
          filter: "blur(0px)", //[cite: 3]
          duration: 12,
          ease: "power3.out", //[cite: 3]
        },
        30 //[cite: 3]
      );
      tl.fromTo(
        opticsBlockRef.current.querySelectorAll("[data-spec]"), //[cite: 3]
        { autoAlpha: 0, x: 20 },
        {
          autoAlpha: 1, //[cite: 3]
          x: 0, //[cite: 3]
          duration: 8,
          stagger: 3,
          ease: "power2.out", //[cite: 3]
        },
        34 //[cite: 3]
      );
      tl.to(
        opticsBlockRef.current, //[cite: 3]
        { yPercent: -8, duration: 24, ease: "none" }, //[cite: 3]
        34 //[cite: 3]
      );
      tl.to(
        opticsBlockRef.current, //[cite: 3]
        {
          autoAlpha: 0, //[cite: 3]
          filter: "blur(12px)", //[cite: 3]
          duration: 8,
          ease: "power2.in", //[cite: 3]
        },
        58 //[cite: 3]
      );

      /* ── ACT III · 70–100% ── */
      tl.fromTo(
        ctaBlockRef.current, //[cite: 3]
        { autoAlpha: 0, y: 40, filter: "blur(10px)" }, //[cite: 3]
        {
          autoAlpha: 1, //[cite: 3]
          y: 0, //[cite: 3]
          filter: "blur(0px)", //[cite: 3]
          duration: 12, //[cite: 3]
          ease: "power3.out", //[cite: 3]
        },
        70 //[cite: 3]
      );
      tl.fromTo(
        ctaBlockRef.current.querySelectorAll("[data-cta-item]"), //[cite: 3]
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 10, stagger: 3, ease: "power2.out" }, //[cite: 3]
        74 //[cite: 3]
      );
    }, sectionRef); //[cite: 3]

    /* ─────────────────────────────────────────────
       CLEANUP[cite: 3]
    ───────────────────────────────────────────── */
    return () => {
      ScrollTrigger.getAll().forEach(st => st.kill());

      gsapCtx.revert(); //[cite: 3]

      window.removeEventListener("resize", resizeCanvas); //[cite: 3]
      if (sectionRef.current) {
        sectionRef.current.style.position = 'relative';
        sectionRef.current.style.height = '100svh';
      }
    };
  }, []);

  /* ───────────────────────────────────────────────
     STYLES — Haute Horlogerie / Ultra Premium
  ─────────────────────────────────────────────── */
  const colors = {
    gold: "#ffc830",
    platinum: "#E5E4E2",
    subtle: "rgba(229, 228, 226, 0.6)",
    dark: "#000000"
  };

  const s = {
    section: {
      position: "relative", //[cite: 3]
      width: "100%", //[cite: 3]
      height: "100svh", //[cite: 3]
      background: colors.dark, //[cite: 3]
      overflow: "hidden", //[cite: 3]
    },
    canvas: {
      position: "absolute", //[cite: 3]
      inset: 0, //[cite: 3]
      width: "100%", //[cite: 3]
      height: "100%", //[cite: 3]
      display: "block", //[cite: 3]
    },
    overlay: {
      position: "absolute", //[cite: 3]
      inset: 0, //[cite: 3]
      pointerEvents: "none", //[cite: 3]
      zIndex: 2, //[cite: 3]
    },
    /* ACT I */
    titleBlock: {
      position: "absolute", //[cite: 3]
      top: "50%", //[cite: 3]
      left: "50%", //[cite: 3]
      transform: "translate(-50%, -50%)", //[cite: 3]
      textAlign: "center", //[cite: 3]
      width: "min(92vw, 1400px)", //[cite: 3]
      willChange: "transform, opacity", //[cite: 3]
    },
    eyebrow: {
      fontFamily: "'Montserrat', sans-serif",
      fontSize: "clamp(0.6rem, 1vw, 0.75rem)", //[cite: 3]
      letterSpacing: "0.5em",
      textTransform: "uppercase", //[cite: 3]
      color: colors.gold,
      marginBottom: "clamp(1rem, 2.5svh, 2rem)", //[cite: 3]
    },
    h1: {
      fontFamily: "'Cormorant Garamond', serif",
      fontWeight: 400,
      fontStyle: "italic",
      fontSize: "clamp(3.5rem, 12vw, 12rem)",
      lineHeight: 0.9,
      letterSpacing: "-0.02em",
      color: colors.platinum,
      margin: 0, //[cite: 3]
    },
    subtitle: {
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 300,
      fontSize: "clamp(0.75rem, 1.2vw, 0.95rem)",
      letterSpacing: "0.25em",
      textTransform: "uppercase", //[cite: 3]
      color: colors.subtle,
      marginTop: "clamp(1.5rem, 4svh, 3rem)",
    },
    /* ACT II */
    opticsBlock: {
      position: "absolute", //[cite: 3]
      top: "50%", //[cite: 3]
      right: "clamp(1.25rem, 6vw, 8rem)", //[cite: 3]
      transform: "translateY(-50%)", //[cite: 3]
      textAlign: "right", //[cite: 3]
      maxWidth: "min(86vw, 640px)", //[cite: 3]
      willChange: "transform, opacity", //[cite: 3]
    },
    h2: {
      fontFamily: "'Cormorant Garamond', serif",
      fontWeight: 400,
      fontSize: "clamp(2.5rem, 7vw, 6rem)",
      lineHeight: 0.95, //[cite: 3]
      letterSpacing: "0em",
      color: colors.platinum,
      margin: 0, //[cite: 3]
    },
    specList: {
      marginTop: "clamp(2rem, 4svh, 3.5rem)",
      display: "flex", //[cite: 3]
      flexDirection: "column", //[cite: 3]
      gap: "1.2em",
      alignItems: "flex-end", //[cite: 3]
    },
    specLine: {
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 400,
      fontSize: "clamp(0.65rem, 1.1vw, 0.85rem)",
      letterSpacing: "0.25em",
      textTransform: "uppercase", //[cite: 3]
      color: colors.subtle,
      borderRight: `1px solid ${colors.gold}`,
      paddingRight: "1.5em",
    },
    specAccent: { color: colors.gold, padding: "0 0.5em" },
    /* ACT III */
    ctaBlock: {
      position: "absolute", //[cite: 3]
      bottom: "clamp(3rem, 9svh, 7rem)", //[cite: 3]
      left: "50%", //[cite: 3]
      transform: "translateX(-50%)", //[cite: 3]
      textAlign: "center", //[cite: 3]
      width: "min(92vw, 900px)", //[cite: 3]
      pointerEvents: "auto", //[cite: 3]
      willChange: "transform, opacity", //[cite: 3]
    },
    h3: {
      fontFamily: "'Cormorant Garamond', serif",
      fontWeight: 400,
      fontSize: "clamp(2.2rem, 6vw, 5rem)",
      lineHeight: 0.95, //[cite: 3]
      color: colors.platinum,
      margin: 0, //[cite: 3]
    },
    ctaMeta: {
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 300,
      fontSize: "clamp(0.6rem, 1vw, 0.72rem)", //[cite: 3]
      letterSpacing: "0.35em", //[cite: 3]
      textTransform: "uppercase", //[cite: 3]
      color: colors.subtle,
      marginTop: "1.5rem",
    },
    /* HUD */
    hud: {
      position: "absolute", //[cite: 3]
      bottom: "clamp(1rem, 3svh, 2.5rem)",
      left: "clamp(1rem, 3vw, 3rem)",
      display: "flex", //[cite: 3]
      flexDirection: "column", //[cite: 3]
      gap: "0.8rem",
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 300,
      fontSize: "clamp(0.55rem, 0.9vw, 0.68rem)", //[cite: 3]
      letterSpacing: "0.25em", //[cite: 3]
      color: colors.subtle,
      zIndex: 3, //[cite: 3]
      pointerEvents: "none", //[cite: 3]
    },
    hudBarTrack: {
      width: "clamp(100px, 14vw, 180px)",
      height: 1, //[cite: 3]
      background: "rgba(229, 228, 226, 0.15)",
      position: "relative", //[cite: 3]
      overflow: "hidden", //[cite: 3]
    },
    hudBarFill: {
      position: "absolute", //[cite: 3]
      inset: 0, //[cite: 3]
      background: colors.gold,
      transform: "scaleX(0)", //[cite: 3]
      transformOrigin: "left center", //[cite: 3]
      willChange: "transform", //[cite: 3]
    },
    scrollHint: {
      position: "absolute", //[cite: 3]
      bottom: "clamp(1rem, 3svh, 2.5rem)",
      right: "clamp(1rem, 3vw, 3rem)",
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 300,
      fontSize: "clamp(0.55rem, 0.9vw, 0.68rem)", //[cite: 3]
      letterSpacing: "0.3em", //[cite: 3]
      textTransform: "uppercase", //[cite: 3]
      color: colors.subtle,
      display: "flex", //[cite: 3]
      alignItems: "center", //[cite: 3]
      gap: "1rem",
      zIndex: 3, //[cite: 3]
      pointerEvents: "none", //[cite: 3]
    },
    /* Loader */
    loader: {
      position: "absolute", //[cite: 3]
      inset: 0, //[cite: 3]
      background: colors.dark,
      display: "flex", //[cite: 3]
      alignItems: "center", //[cite: 3]
      justifyContent: "center", //[cite: 3]
      zIndex: 5, //[cite: 3]
      pointerEvents: "none", //[cite: 3]
    },
    loaderText: {
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 300,
      fontSize: "clamp(0.6rem, 1vw, 0.75rem)", //[cite: 3]
      letterSpacing: "0.4em",
      textTransform: "uppercase", //[cite: 3]
      color: colors.gold,
    },
  };

  return (
    <section
      ref={sectionRef} //[cite: 3]
      className="aeon-hero-section" //[cite: 3]
      style={s.section} //[cite: 3]
      aria-label="High End Watch Hero"
    >
      <style>{`
        @keyframes watch-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .aeon-hint-dot {
          width: 4px;
          height: 4px;
          background: ${colors.gold};
          border-radius: 50%;
          animation: watch-pulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .aeon-cta-btn {
          font-family: 'Montserrat', sans-serif;
          font-weight: 400;
          font-size: clamp(0.65rem, 1vw, 0.8rem);
          letter-spacing: 0.35em;
          text-transform: uppercase;
          color: ${colors.dark};
          background: ${colors.platinum};
          border: 1px solid ${colors.platinum};
          padding: clamp(1rem, 2.5svh, 1.4rem) clamp(2.5rem, 5vw, 4.5rem);
          margin-top: clamp(2rem, 5svh, 3.5rem);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 1.2rem;
          transition: background-color 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                      color 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 0.7s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform;
        }
        .aeon-cta-btn:hover {
          background: transparent;
          border-color: ${colors.gold};
          color: ${colors.gold};
        }
        .aeon-cta-btn:active {
          transform: scale(0.98);
        }
        .aeon-cta-arrow {
          display: inline-block;
          font-weight: 300;
          transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .aeon-cta-btn:hover .aeon-cta-arrow {
          transform: translate(4px, -4px);
        }

        /* dvh where supported — prevents iOS Safari viewport jump */
        @supports (height: 100svh) {
          .aeon-hero-section { height: 100svh !important; }
        }

        /* Mobile portrait refinements */
        @media (max-width: 767px) {
          .aeon-optics-block {
            right: 1.5rem !important;
            left: 1.5rem !important;
            max-width: none !important;
            text-align: left !important;
          }
          .aeon-optics-block .aeon-spec-list {
            align-items: flex-start !important;
          }
          .aeon-optics-block [data-spec] {
            border-right: none !important;
            border-left: 1px solid ${colors.gold} !important;
            padding-right: 0 !important;
            padding-left: 1.5em !important;
          }
          .aeon-scroll-hint { display: none !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .aeon-hint-dot { animation: none; }
        }
          .aeon-back-link {
          position: absolute;
          top: clamp(1.5rem, 4svh, 3rem);
          left: clamp(1.5rem, 4vw, 3rem);
          font-family: 'Montserrat', sans-serif;
          font-weight: 300;
          font-size: clamp(0.55rem, 0.9vw, 0.7rem);
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: rgba(229, 228, 226, 0.6);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          z-index: 50; /* Assicura che sia sempre cliccabile sopra al canvas */
          transition: color 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .aeon-back-link:hover {
          color: #C5A059; /* Oro champagne al passaggio del mouse */
          transform: translateX(-4px); /* Effetto calamita verso sinistra */
        }
        .aeon-back-link span {
          font-size: 1.1em;
          margin-bottom: 2px;
        }
      `}</style>

      {/* ── NAVIGAZIONE ───────────────────────── */}
      <Link 
        to="/" 
        state={{ scrollToWorks: true }} 
        onClick={() => {
          // Forza la morte immediata di ogni animazione GSAP locale
          ScrollTrigger.getAll().forEach(t => t.kill());
        }}
        className="aeon-back-link"
      >
        <span aria-hidden="true">←</span> BACK TO INDEX
      </Link>

      {/* ── CANVAS ────────────────────────────── */}
      <canvas ref={canvasRef} style={s.canvas} aria-hidden="true" />

      {/* ── LOADER ──────────────────────────────── */}
      <div ref={loaderRef} style={s.loader}>
        <span ref={loaderPctRef} style={s.loaderText}>
          ASSEMBLING CALIBRE — 0%
        </span>
      </div>

      {/* ── OVERLAYS ────────────────────────────── */}
      <div style={s.overlay}>
        {/* ACT I · 0–20% */}
        <div ref={titleBlockRef} style={s.titleBlock}>
          <div style={s.eyebrow}>GENÈVE, SUISSE</div>
          <h1 style={s.h1}>
            AURORA
            <br />
            SKELETONIZED
          </h1>
          <p style={s.subtitle}>The pinnacle of haute horlogerie.</p>
        </div>

        {/* ACT II · 30–60% */}
        <div
          ref={opticsBlockRef}
          className="aeon-optics-block" //[cite: 3]
          style={s.opticsBlock} //[cite: 3]
        >
          <div style={s.eyebrow}>
            CALIBRE 7X // TITANIUM
          </div>
          <h2 style={s.h2}>
            MECHANICAL
            <br />
            PERFECTION
          </h2>
          <div className="aeon-spec-list" style={s.specList}>
            <div data-spec style={s.specLine}>
              SAPPHIRE CRYSTAL <span style={s.specAccent}>|</span> GRADE 5 TITANIUM
            </div>
            <div data-spec style={s.specLine}>
              TOURBILLON ESCAPEMENT <span style={s.specAccent}>|</span> 28,800 VPH
            </div>
            <div data-spec style={s.specLine}>
              72-HOUR POWER RESERVE <span style={s.specAccent}>|</span> 45 JEWELS
            </div>
          </div>
        </div>

        {/* ACT III · 70–100% */}
        <div ref={ctaBlockRef} style={s.ctaBlock}>
          <div data-cta-item style={{ ...s.eyebrow, marginBottom: "1.5rem" }}>
            LIMITED PRODUCTION // 100 PIECES
          </div>
          <h3 data-cta-item style={s.h3}>
            ACQUIRE TIMEPIECE
          </h3>
          <div data-cta-item style={s.ctaMeta}>
            AVAILABLE FOR EXCLUSIVE CLIENTELE
          </div>
          <div data-cta-item>
            <button
              ref={ctaButtonRef} //[cite: 3]
              className="aeon-cta-btn" //[cite: 3]
              type="button" //[cite: 3]
              onClick={() => {
                /* hook your checkout / waitlist route here */ //[cite: 3]
              }}
            >
              REQUEST ALLOCATION
              <span className="aeon-cta-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── HUD ─────────────────────────────────── */}
      <div style={s.hud} aria-hidden="true">
        <span ref={hudFrameRef}>CALIBRE 7X — FR 001 / {FRAME_COUNT}</span>
        <div style={s.hudBarTrack}>
          <div ref={hudBarRef} style={s.hudBarFill} />
        </div>
      </div>

      {/* ── SCROLL HINT ─────────────────────────── */}
      <div
        ref={scrollHintRef} //[cite: 3]
        className="aeon-scroll-hint" //[cite: 3]
        style={s.scrollHint} //[cite: 3]
        aria-hidden="true" //[cite: 3]
      >
        <span className="aeon-hint-dot" />
        SCROLL TO EXPLORE CALIBRE
      </div>
    </section>
  );
}