/**
 * ContactPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Awwwards / FWA–grade contact page with smooth In/Out routing transitions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:     "#050302",
  bgDeep: "#030201",
  accent: "#F4A261",
  gold:   "#E9C46A",
  text:   "#F0E6D3",
  muted:  "rgba(240,230,211,0.46)",
  faint:  "rgba(240,230,211,0.055)",
  border: "rgba(244,162,97,0.12)",
};

const FONT = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const MONO = "'JetBrains Mono', 'IBM Plex Mono', 'Courier New', monospace";

// ─── API endpoint ─────────────────────────────────────────────────────────────
// Configurabile via Vite env. In DEV punta al backend FastAPI
// (es. VITE_API_URL="http://localhost:8000"); in PROD same-origin lascialo vuoto
// e la chiamata resta relativa ("/api/contact"). Nessun impatto su UI/CSS/GSAP.
const API_BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Scoped CSS ───────────────────────────────────────────────────────────────
const STYLES = `
  .cp-root, .cp-root * { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Page shell ── */
  .cp-root {
    position: relative;
    width: 100%;
    min-height: 100vh;
    background: ${C.bg};
    display: grid;
    grid-template-columns: 55fr 45fr;
    overflow: hidden;
    opacity: 0; /* Anti-FOUC: GSAP will fade this in */
  }

  /* ── Page Transition Veil ── */
  .cp-veil {
    position: fixed;
    inset: 0;
    background: ${C.bgDeep};
    z-index: 9999;
    pointer-events: none;
    transform-origin: top;
  }

  /* ── Grain overlay ── */
  .cp-grain {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 50;
    opacity: 0.035;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px 200px;
  }

  /* ── Back to Home Button ── */
  .cp-back-btn-wrap {
    position: absolute;
    top: clamp(1.5rem, 3vw, 2.5rem);
    left: clamp(1.5rem, 3vw, 2.5rem);
    z-index: 100;
  }
  
  .cp-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    background: transparent;
    border: none;
    color: ${C.muted};
    font-family: ${MONO};
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
    padding: 0.5rem;
    transition: color 0.3s ease;
  }
  .cp-back-btn:hover { color: ${C.accent}; }
  .cp-back-arrow { font-size: 0.8rem; transition: transform 0.3s ease; }
  .cp-back-btn:hover .cp-back-arrow { transform: translateX(-4px); }

  /* ══════════════════════════════
     LEFT PANEL
  ══════════════════════════════ */
  .cp-left {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: clamp(6rem, 8vw, 7rem) clamp(2.5rem, 5vw, 6rem);
    border-right: 1px solid ${C.border};
    position: relative;
  }

  .cp-eyebrow {
    font-family: ${MONO};
    font-size: clamp(0.6rem, 0.7vw, 0.72rem);
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: ${C.accent};
    margin-bottom: clamp(1.8rem, 3.5vw, 2.8rem);
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }
  .cp-eyebrow::before {
    content: '';
    display: block;
    width: 1.8rem;
    height: 1px;
    background: ${C.accent};
    flex-shrink: 0;
  }

  .cp-title {
    font-family: ${FONT};
    font-size: clamp(3.8rem, 7.8vw, 9.5rem);
    font-weight: 300;
    line-height: 0.88;
    letter-spacing: -0.03em;
    color: ${C.text};
    user-select: none;
  }

  .cp-word-wrap {
    display: block;
    overflow: hidden;
    padding-bottom: 0.04em;
  }
  .cp-word-inner {
    display: block;
    will-change: transform;
  }

  .cp-w-stroke { -webkit-text-stroke: 1.5px ${C.text}; color: transparent; font-style: italic; }
  .cp-w-accent { color: ${C.accent}; -webkit-text-stroke: 0; }
  .cp-w-gold   { color: ${C.gold}; }

  .cp-tagline {
    font-family: ${MONO};
    font-size: clamp(0.65rem, 0.85vw, 0.82rem);
    color: ${C.muted};
    letter-spacing: 0.06em;
    line-height: 1.75;
    margin-top: clamp(2rem, 4vw, 3.5rem);
    max-width: 34ch;
  }

  /* ══════════════════════════════
     RIGHT PANEL (Form)
  ══════════════════════════════ */
  .cp-right {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: clamp(3rem, 6vw, 7rem) clamp(2.5rem, 5vw, 5rem);
  }

  .cp-form-meta { margin-bottom: clamp(2.5rem, 4.5vw, 4rem); }
  .cp-form-tag {
    font-family: ${MONO};
    font-size: 0.62rem;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: ${C.muted};
    margin-bottom: 0.6rem;
  }
  .cp-form-heading {
    font-family: ${FONT};
    font-size: clamp(1.5rem, 2.4vw, 2.1rem);
    font-weight: 400;
    color: ${C.text};
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  /* ── Floating Field ── */
  .cp-field { position: relative; margin-bottom: 3rem; }
  .cp-label {
    position: absolute; top: 0.65rem; left: 0;
    font-family: ${MONO}; font-size: 0.68rem; letter-spacing: 0.18em;
    text-transform: uppercase; color: ${C.muted}; pointer-events: none;
    transition: all 0.24s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    will-change: top, font-size; z-index: 1;
  }
  .cp-label--active { top: -1.3rem; font-size: 0.58rem; color: ${C.accent}; letter-spacing: 0.22em; }

  .cp-input, .cp-textarea {
    width: 100%; background: transparent; border: none;
    border-bottom: 1px solid ${C.border}; outline: none; color: ${C.text};
    font-family: ${FONT}; font-size: clamp(1rem, 1.15vw, 1.1rem);
    padding: 0.5rem 0 0.6rem; transition: border-color 0.3s ease; caret-color: ${C.accent};
  }
  .cp-input:focus, .cp-textarea:focus { border-bottom-color: ${C.accent}88; }
  .cp-textarea { resize: none; height: 90px; line-height: 1.55; display: block; padding-top: 0.5rem; }
  .cp-field--textarea .cp-label { top: 0.5rem; }
  .cp-field--textarea .cp-label--active { top: -1.3rem; }

  .cp-field::after {
    content: ''; position: absolute; bottom: 0; left: 0; width: 0; height: 1px;
    background: ${C.accent}; transition: width 0.35s cubic-bezier(0.76, 0, 0.24, 1);
  }
  .cp-field--focused::after { width: 100%; }

  /* ── Submit Button ── */
  .cp-btn-wrap { margin-top: 0.25rem; position: relative; display: block; width: 100%; }
  .cp-btn {
    position: relative; width: 100%; padding: clamp(1rem, 1.6vw, 1.3rem) 2rem;
    background: transparent; border: 1px solid ${C.accent}88; color: ${C.accent};
    font-family: ${MONO}; font-size: 0.75rem; letter-spacing: 0.25em; text-transform: uppercase;
    cursor: pointer; overflow: hidden; transition: all 0.45s ease;
    display: flex; align-items: center; justify-content: center; gap: 1rem;
  }
  .cp-btn::before {
    content: ''; position: absolute; inset: 0; background: ${C.accent};
    transform: translateX(-101%); transition: transform 0.55s cubic-bezier(0.76, 0, 0.24, 1);
    pointer-events: none;
  }
  .cp-btn:hover::before, .cp-btn.cp-btn--loading::before { transform: translateX(0); }
  .cp-btn:hover { color: ${C.bg}; border-color: ${C.accent}; }
  .cp-btn--loading { color: ${C.bg}; pointer-events: none; }
  .cp-btn--success { border-color: ${C.gold}; color: ${C.bg}; pointer-events: none; }
  .cp-btn--success::before { background: ${C.gold}; transform: translateX(0) !important; }

  .cp-btn-label { position: relative; z-index: 1; }
  .cp-btn-arrow { position: relative; z-index: 1; font-size: 1.1rem; transition: transform 0.3s ease; }
  .cp-btn:hover .cp-btn-arrow { transform: translateX(5px); }

  /* Status line */
  .cp-status {
    font-family: ${MONO}; font-size: 0.6rem; letter-spacing: 0.12em; text-align: center;
    margin-top: 1.5rem; min-height: 1em; transition: opacity 0.4s;
  }
  .cp-status--error { color: #e07878; }
  .cp-status--success { color: ${C.gold}; }

  /* ══════════════════════════════
     MOBILE
  ══════════════════════════════ */
  @media (max-width: 820px) {
    .cp-root { grid-template-columns: 1fr; min-height: auto; padding-top: 4rem; }
    .cp-back-btn-wrap { top: 1.5rem; left: 1rem; }
    .cp-left { border-right: none; border-bottom: 1px solid ${C.border}; padding: 3.5rem clamp(1.5rem, 7vw, 3rem) 3.5rem; }
    .cp-right { padding: 3.5rem clamp(1.5rem, 7vw, 3rem) 5rem; }
    .cp-title { font-size: clamp(3.2rem, 14vw, 5rem); }
  }
`;

// ─── FloatingField Component ──────────────────────────────────────────────────
function FloatingField({ label, name, type = "text", value, onChange, as = "input" }) {
  const [focused, setFocused] = useState(false);
  const isActive  = focused || value.length > 0;
  const isTextarea = as === "textarea";

  return (
    <div className={`cp-field${isTextarea ? " cp-field--textarea" : ""}${focused ? " cp-field--focused" : ""}`}>
      <label className={`cp-label${isActive ? " cp-label--active" : ""}`} htmlFor={name}>{label}</label>
      {isTextarea ? (
        <textarea id={name} name={name} className="cp-textarea" value={value} onChange={onChange}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} rows={3} spellCheck="false" />
      ) : (
        <input id={name} name={name} type={type} className="cp-input" value={value} onChange={onChange}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} autoComplete="off" spellCheck="false" />
      )}
    </div>
  );
}

const TITLE_WORDS = [
  { text: "Let's",     cls: "" },
  { text: "build",     cls: "" },
  { text: "something", cls: "cp-w-stroke" },
  { text: "worth",     cls: "" },
  { text: "shipping.", cls: "cp-w-gold" },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ContactPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", subject: "", details: "" });
  const [status, setStatus] = useState("idle"); 
  const [errorMsg, setErrorMsg] = useState("");

  const rootRef    = useRef(null);
  const veilRef    = useRef(null);
  const leftRef    = useRef(null);
  const rightRef   = useRef(null);
  const eyebrowRef = useRef(null);
  const taglineRef = useRef(null);
  const btnRef     = useRef(null);
  const backBtnRef = useRef(null);

  // 1. Inject Styles
  useEffect(() => {
    const STYLE_ID = "contact-page-styles";
    if (!document.getElementById(STYLE_ID)) {
      const el = document.createElement("style");
      el.id = el.dataset.scope = STYLE_ID;
      el.textContent = STYLES;
      document.head.appendChild(el);
    }
    return () => document.getElementById(STYLE_ID)?.remove();
  }, []);

  // 2. Entrance Animation (using useLayoutEffect to prevent FOUC)
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const wordInners = leftRef.current.querySelectorAll(".cp-word-inner");
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      // Ensure root is visible, then animate the veil away
      gsap.set(rootRef.current, { opacity: 1 });
      
      tl.to(veilRef.current, { scaleY: 0, duration: 1.2, ease: "expo.inOut" }, 0)
        .fromTo(eyebrowRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, 0.6)
        .fromTo(wordInners, { yPercent: 115 }, { yPercent: 0, duration: 1.2, stagger: 0.075 }, 0.7)
        .fromTo(rightRef.current, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 1.0, ease: "power3.out" }, 1.0)
        .fromTo(backBtnRef.current, { opacity: 0, x: -15 }, { opacity: 1, x: 0, duration: 0.8 }, 1.2)
        .fromTo(taglineRef.current, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9 }, 1.3);
    });
    return () => ctx.revert();
  }, []);

  // 3. Exit Animation & Navigation Logic
  const handleGoBack = useCallback((e) => {
    e.preventDefault();
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ 
        onComplete: () => {
          // Naviga verso la home e passa l'istruzione di scrollare all'ID "contact-section"
          navigate("/", { state: { scrollTo: 'contact-section' } });
        }
      });
      // Bring the veil back down over the screen
      tl.to(veilRef.current, { 
        scaleY: 1, 
        transformOrigin: "top", 
        duration: 0.8, 
        ease: "expo.inOut" 
      });
    });
    return () => ctx.revert();
  }, [navigate]);

  // 4. Form Handlers & Interaction
  const handleMagnetMove = useCallback((e) => {
    if (!btnRef.current || status !== "idle") return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width  / 2) * 0.22;
    const y = (e.clientY - rect.top  - rect.height / 2) * 0.22;
    gsap.to(btnRef.current, { x, y, duration: 0.35, ease: "power2.out" });
  }, [status]);

  const handleMagnetLeave = useCallback(() => {
    if (!btnRef.current) return;
    gsap.to(btnRef.current, { x: 0, y: 0, duration: 0.65, ease: "elastic.out(1, 0.55)" });
  }, []);

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "loading" || status === "success") return;

    // Strict frontend validation before hitting the Python backend
    if (!form.name.trim() || !form.email.trim() || !form.details.trim()) {
      setStatus("error");
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, timestamp: new Date().toISOString() }),
      });

      if (!res.ok) {
        // Legge il messaggio d'errore strutturato di FastAPI ({ detail: "..." }).
        let detail = "Server error, please try again.";
        try {
          const data = await res.json();
          if (data && typeof data.detail === "string") detail = data.detail;
        } catch { /* risposta non-JSON: tieni il default */ }
        throw new Error(detail);
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Network issue. Please try again.");
    }
  };

  const btnLabel = {
    idle: "Start the project", loading: "Sending…", success: "Message received ✓", error: "Try again",
  }[status] ?? "Start the project";

  return (
    <>
      <div className="cp-grain" aria-hidden="true" />
      
      {/* ── Page Transition Veil ── */}
      <div className="cp-veil" ref={veilRef} />

      <main className="cp-root" ref={rootRef}>

        {/* ── Back Button ── */}
        <div className="cp-back-btn-wrap" ref={backBtnRef} style={{ opacity: 0 }}>
          <button onClick={handleGoBack} className="cp-back-btn" aria-label="Go back to home page">
            <span className="cp-back-arrow">←</span> HOME
          </button>
        </div>

        {/* ── LEFT PANEL ── */}
        <section className="cp-left" ref={leftRef}>
          <p className="cp-eyebrow" ref={eyebrowRef}>New project inquiry</p>
          <h1 className="cp-title">
            {TITLE_WORDS.map((word, i) => (
              <span className="cp-word-wrap" key={i}>
                <span className={`cp-word-inner ${word.cls}`.trim()}>{word.text}</span>
              </span>
            ))}
          </h1>
          <p className="cp-tagline" ref={taglineRef}>
            Fill out the form and I'll get back to you<br />
            within 24 hours to discuss scope,<br />
            timeline, and budget.
          </p>
        </section>

        {/* ── RIGHT PANEL ── */}
        <section className="cp-right" ref={rightRef} style={{ opacity: 0 }}>
          <div className="cp-form-meta">
            <p className="cp-form-tag">01 / Let's talk</p>
            <h2 className="cp-form-heading">Tell me about<br />your project.</h2>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <FloatingField label="Name" name="name" value={form.name} onChange={handleChange} />
            <FloatingField label="Email" name="email" type="email" value={form.email} onChange={handleChange} />
            <FloatingField label="Project subject" name="subject" value={form.subject} onChange={handleChange} />
            <FloatingField label="Project details" name="details" as="textarea" value={form.details} onChange={handleChange} />

            <div className="cp-btn-wrap">
              <button
                ref={btnRef}
                type="submit"
                className={`cp-btn ${status === "loading" ? "cp-btn--loading" : ""} ${status === "success" ? "cp-btn--success" : ""}`}
                onMouseMove={handleMagnetMove}
                onMouseLeave={handleMagnetLeave}
                disabled={status === "success"}
              >
                <span className="cp-btn-label">{btnLabel}</span>
                {status === "idle" && <span className="cp-btn-arrow" aria-hidden="true">→</span>}
              </button>
            </div>

            {(status === "error" || status === "success") && (
              <p className={`cp-status cp-status--${status}`}>
                {status === "success" ? "I'll reply within 24 hours. Looking forward to it." : errorMsg}
              </p>
            )}
          </form>
        </section>

      </main>
    </>
  );
}