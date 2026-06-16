import { useEffect, useRef, memo, useState, useCallback, useMemo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS — invariati
═══════════════════════════════════════════════════════════ */
const C = {
  bg:        '#020100',                 // nero profondo
  bg2:       '#050302',                 // nero secondario
  bgHack:    '#0A0203',                 // shift di sfondo durante il breach
  acc:       '#F4A261',                 // accent default — ambra
  gold:      '#E9C46A',                 // accent secondario — oro
  txt:       '#F0E6D3',                 // bianco caldo
  mut:       'rgba(240,230,211,0.4)',   // testo attenuato
  alert:     '#D62828',                 // accent hacked — crimson digitale
  alertDeep: '#C1121F',                 // crimson profondo (bordi/ombre)
  hair:      'rgba(240,230,211,0.08)',  // hairline neutro (bordi architettonici)
  blueprint: 'rgba(240,230,211,0.05)',  // linee blueprint estese
};

const MONO    = "'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', monospace";
const GROTESK = "'Cabinet Grotesk', 'Space Grotesk', 'Clash Display', sans-serif";
const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789◈⬡◎§#@%&+=<>';

/* ═══════════════════════════════════════════════════════════
   HOVER SCRAMBLE
   DOM direct (textContent) — zero setState, zero re-render
═══════════════════════════════════════════════════════════ */
const HoverScramble = memo(({ text, color }) => {
  const spanRef     = useRef(null);
  const intervalRef = useRef(null);

  const handleMouseEnter = useCallback(() => {
    let iteration = 0;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!spanRef.current) return;
      spanRef.current.textContent = text
        .split('')
        .map((char, idx) => {
          if (char === ' ') return ' ';
          if (idx < iteration) return text[idx];
          return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        })
        .join('');
      if (iteration >= text.length) clearInterval(intervalRef.current);
      iteration += 0.5;
    }, 20);
  }, [text]);

  const handleMouseLeave = useCallback(() => {
    clearInterval(intervalRef.current);
    if (spanRef.current) spanRef.current.textContent = text;
  }, [text]);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <span
      ref={spanRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ color, cursor: 'crosshair', display: 'inline-block' }}
    >
      {text}
    </span>
  );
});
HoverScramble.displayName = 'HoverScramble';


/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function BrutalistManifesto() {
  /* ── Refs DOM ─────────────────────────────────────────── */
  const sectionRef    = useRef(null);
  const imageRef      = useRef(null);     // <img> → GSAP parallax + filter
  const imageWrapRef  = useRef(null);     // overflow:hidden wrapper → clip-path reveal
  const glitchWrapRef = useRef(null);     // inner div → CSS glitch keyframe (Samsung fix:
                                          //   CSS transform isolato da GSAP transform su img)
  const titleLinesRef = useRef([]);       // h2 slide-up
  const terminalRef   = useRef(null);     // terminale box
  const bordersRef    = useRef([]);       // corner markers immagine
  const uptimeRef     = useRef(null);     // span clock DOM-direct
  const glowRef       = useRef(null);     // div glow magnetico

  /* ── Ref per isHacked accessibile nei listener GSAP ─── */
  const isHackedRef   = useRef(false);

  /* ── State ───────────────────────────────────────────── */
  const [isHacked, setIsHacked] = useState(false);

  /* ── Computed values ─────────────────────────────────── */
  const themeColor = useMemo(() => isHacked ? C.alert : C.acc, [isHacked]);

  /* ── Tap mobile ────────────────────────────────────────
     Il double-tap-zoom nativo (che causava il layer nero su Samsung)
     è neutralizzato da `touch-action: manipulation` sull'elemento JSX.
     NB: NON usiamo più e.preventDefault() qui — su touchstart bloccava
     l'avvio dello scroll (vedi fix scroll-lock #2 in handleTapOverride).
  ─────────────────────────────────────────────────────── */
  const tapCount = useRef(0);
  const tapTimer = useRef(null);
  const lastTouch = useRef(0);   // dedup touchstart→click sintetico (fix scroll-lock)

  const handleTapOverride = useCallback((e) => {
    /* ══════════════════════════════════════════════════════════════
       🐛 FIX SCROLL-LOCK MOBILE — causa #2 (concorrente alla #1)
       ────────────────────────────────────────────────────────────
       PRIMA: e.preventDefault() veniva chiamato SEMPRE, anche sul
       'touchstart'. preventDefault su touchstart può ANNULLARE l'avvio
       dello scroll nativo: se il dito iniziava uno swipe verticale
       proprio su questa riga del terminale, il gesto veniva cancellato
       → contributo diretto al "non riesco a scrollare nella sezione".
       Il double-tap-zoom è GIÀ neutralizzato da `touch-action:
       manipulation` su questo elemento → preventDefault era ridondante
       oltre che dannoso, quindi è stato RIMOSSO.

       Dedup touchstart+click: su touch un tap genera SIA 'touchstart'
       SIA un 'click' sintetico; senza dedup conteremmo 2 tap per ogni
       tocco. Ignorando il click che segue di poco un touchstart, la
       logica "TAP ×5" resta esattamente 5 tap fisici (invariata).
    ══════════════════════════════════════════════════════════════ */
    if (e.type === 'touchstart') {
      lastTouch.current = Date.now();
    } else if (e.type === 'click' && Date.now() - lastTouch.current < 700) {
      return; // click sintetico dello stesso tap → ignora
    }
    if (isHacked) return;
    tapCount.current += 1;
    clearTimeout(tapTimer.current);
    if (tapCount.current >= 5) {
      setIsHacked(true);
      tapCount.current = 0;
    } else {
      tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 600);
    }
  }, [isHacked]);

  const handleReboot = useCallback(() => {
    setIsHacked(false);
    tapCount.current = 0;
  }, []);


  /* ── 1. Sync isHackedRef — accessibile senza closure stale ── */
  useEffect(() => { isHackedRef.current = isHacked; }, [isHacked]);


  /* ── 2. Effetto GSAP su cambio isHacked ─────────────────
     Gestisce il filtro sull'immagine via GSAP (non CSS) così
     non conflicta con il parallax inline-style di GSAP.
  ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;
    if (isHacked) {
      gsap.to(img, {
        filter: 'contrast(2) hue-rotate(180deg) invert(1) brightness(0.8)', // L'effetto hack rimane figo
        duration: 0.2, ease: 'power2.in', overwrite: 'auto',
      });
    } else {
      gsap.to(img, {
        filter: 'brightness(1) contrast(1)', // Torna ai colori normali quando resetti
        scale: 1,
        duration: 0.35, ease: 'power3.out', overwrite: 'auto',
      });
    }
  }, [isHacked]);


  /* ── 3. Keylogger invisibile ─────────────────────────── */
  useEffect(() => {
    let buffer = '';
    const onKey = (e) => {
      if (e.key === 'Escape') { setIsHacked(false); return; }
      if (e.key.length === 1) {
        buffer += e.key.toUpperCase();
        if (buffer.length > 4) buffer = buffer.slice(-4);
        if (buffer === 'HACK' || buffer === 'ROOT') setIsHacked(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);


  /* ── 4. Easter egg console ───────────────────────────── */
  useEffect(() => {
    console.log(
      '%c[SYS.INIT] SECURE KERNEL CONNECTION ESTABLISHED\n%cROUTING TO PYTHON BACKEND...\nSTATUS: 200 OK\nIDENTITY: SEBASTIANO_MOLLO',
      'color: #F4A261; font-size: 14px; font-weight: bold; font-family: monospace;',
      'color: #F0E6D3; font-size: 11px; font-family: monospace;'
    );
  }, []);


  /* ── 5. Uptime clock — DOM direct, zero re-render ───── */
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      if (!uptimeRef.current) return;
      const d  = Date.now() - start;
      const m  = String(Math.floor(d / 60000)).padStart(2, '0');
      const s  = String(Math.floor((d % 60000) / 1000)).padStart(2, '0');
      const ms = String(d % 1000).padStart(3, '0');
      uptimeRef.current.textContent = `${m}:${s}:${ms}`;
    }, 47);
    return () => clearInterval(id);
  }, []);


  /* ── 6. GSAP — context + matchMedia ─────────────────────
     ARCHITETTURA:
     • gsap.context() → cleanup totale al dismount via ctx.revert()
     • gsap.matchMedia() dentro il context → cleanup incluso in ctx
     • Event listeners (glow, img hover) FUORI dal context →
       cleanup esplicito con named-function refs nell'useEffect return
  ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const section   = sectionRef.current;
    const terminal  = terminalRef.current;
    const glow      = glowRef.current;
    const imgWrap   = imageWrapRef.current;
    const img       = imageRef.current;
    if (!section) return;

    /* ── Tutte le animazioni GSAP in un unico context ──── */
    const ctx = gsap.context(() => {

      /* Corner markers: scaleX/Y reveal */
      if (bordersRef.current.length) {
        gsap.fromTo(
          bordersRef.current.filter(Boolean),
          { scaleX: 0, scaleY: 0 },
          {
            scaleX: 1, scaleY: 1,
            duration: 1.1, stagger: 0.07, ease: 'expo.inOut',
            scrollTrigger: { trigger: section, start: 'top 82%', once: true },
          }
        );
      }

      /* Scan-sweep: riga luminosa che percorre la sezione all'entrata */
      gsap.fromTo('.m-scan-sweep',
        { y: 0, opacity: 1 },
        {
          y: () => section.offsetHeight,
          opacity: 0,
          duration: 1.6, ease: 'power2.in',
          scrollTrigger: { trigger: section, start: 'top 82%', once: true },
        }
      );

      /* Title lines: slide-up con leggera rotazione brutalista */
      titleLinesRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(el,
          { yPercent: 115, rotate: i === 0 ? 2.5 : -1.5 },
          {
            yPercent: 0, rotate: 0,
            duration: 1.15, ease: 'power4.out',
            delay: i * 0.12 + 0.05,
            scrollTrigger: { trigger: section, start: 'top 78%', once: true },
          }
        );
      });

      /* Terminal: fade + slide da sinistra */
      if (terminal) {
        gsap.fromTo(terminal,
          { opacity: 0, x: -28 },
          {
            opacity: 1, x: 0,
            duration: 0.85, ease: 'power3.out', delay: 0.5,
            scrollTrigger: { trigger: terminal, start: 'top 90%', once: true },
          }
        );
      }

      /* ── matchMedia per isolare desktop da mobile ──── */
      const mm = gsap.matchMedia();

      /* DESKTOP ≥ 992px */
      mm.add('(min-width: 992px)', () => {

        /* Clip-path reveal dall'alto (dal basso è mobile) */
        if (imgWrap) {
          gsap.fromTo(imgWrap,
            { clipPath: 'inset(100% 0% 0% 0%)' },
            {
              clipPath: 'inset(0% 0% 0% 0%)',
              duration: 1.45, ease: 'power4.inOut',
              scrollTrigger: { trigger: imgWrap, start: 'top 83%', once: true },
            }
          );
        }

        /* Scale + filter reveal con clearProps al complete */
        if (img) {
          gsap.fromTo(img,
            { scale: 1.28, filter: 'brightness(0)' }, // Parte da nero per l'effetto apparizione
            {
              scale: 1,
              filter: 'brightness(1)', // Torna ai suoi colori 100% originali
              duration: 1.65, ease: 'power3.out',
              onComplete: () => {
                /* clearProps filter: CSS prende controllo,
                   GSAP mantiene solo scale e yPercent */
                if (img) gsap.set(img, { clearProps: 'filter' });
              },
              scrollTrigger: { trigger: imgWrap, start: 'top 83%', once: true },
            }
          );

          /* Parallasse verticale — yPercent non conflicta con scale */
          gsap.to(img, {
            yPercent: 18, ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top bottom', end: 'bottom top',
              scrub: 1.2,
            },
          });
        }

        return () => {};
      });

      /* MOBILE ≤ 991px */
      mm.add('(max-width: 991px)', () => {
        if (imgWrap) {
          gsap.fromTo(imgWrap,
            { clipPath: 'inset(0% 0% 100% 0%)' },
            {
              clipPath: 'inset(0% 0% 0% 0%)',
              duration: 1.2, ease: 'power4.inOut',
              scrollTrigger: { trigger: imgWrap, start: 'top 85%', once: true },
            }
          );
        }
        if (img) {
          gsap.fromTo(img,
            { scale: 1.15 },
            {
              scale: 1, duration: 1.4, ease: 'power3.out',
              scrollTrigger: { trigger: imgWrap, start: 'top 85%', once: true },
            }
          );
        }
        return () => {};
      });

    }, section); /* fine gsap.context */


    /* ── Glow magnetico — quickTo fuori dal context ───── */
    let cleanupGlow = () => {};
    if (terminal && glow) {
      const xTo = gsap.quickTo(glow, 'x', { duration: 0.5, ease: 'power3' });
      const yTo = gsap.quickTo(glow, 'y', { duration: 0.5, ease: 'power3' });
      const onMove  = (e) => {
        const r = terminal.getBoundingClientRect();
        xTo(e.clientX - r.left - 130);
        yTo(e.clientY - r.top  - 130);
      };
      const onEnter = () => gsap.to(glow, { opacity: 1, scale: 1,    duration: 0.35, ease: 'power2.out' });
      const onLeave = () => gsap.to(glow, { opacity: 0, scale: 0.85, duration: 0.3 });
      terminal.addEventListener('mousemove',  onMove);
      terminal.addEventListener('mouseenter', onEnter);
      terminal.addEventListener('mouseleave', onLeave);
      cleanupGlow = () => {
        terminal.removeEventListener('mousemove',  onMove);
        terminal.removeEventListener('mouseenter', onEnter);
        terminal.removeEventListener('mouseleave', onLeave);
      };
    }

    /* ── Hover immagine — GSAP fuori dal context ─────────
       isHackedRef evita la closure stale su isHacked.
       yPercent e scale sono prop separate in GSAP → no conflitto.
    ─────────────────────────────────────────────────────── */
    let cleanupImgHover = () => {};
    if (imgWrap && img) {
      const onImgEnter = () => {
        if (isHackedRef.current) return;
        gsap.to(img, {
          scale: 1.055,
          duration: 0.45, ease: 'power2.out', overwrite: 'auto',
        });
      };
      const onImgLeave = () => {
        if (isHackedRef.current) return;
        gsap.to(img, {
          scale: 1,
          duration: 0.7, ease: 'power3.out', overwrite: 'auto',
        });
      };
      imgWrap.addEventListener('mouseenter', onImgEnter);
      imgWrap.addEventListener('mouseleave', onImgLeave);
      cleanupImgHover = () => {
        imgWrap.removeEventListener('mouseenter', onImgEnter);
        imgWrap.removeEventListener('mouseleave', onImgLeave);
      };
    }

    return () => {
      ctx.revert();
      cleanupGlow();
      cleanupImgHover();
    };
  }, []);


  /* ════════════════════════════════════════════════════════
     JSX
  ════════════════════════════════════════════════════════ */
  return (
    <section
      ref={sectionRef}
      className={`manifesto-section${isHacked ? ' system-hacked' : ''}`}
      style={{
        position: 'relative',
        backgroundColor: isHacked ? C.bgHack : C.bg,
        color: C.txt,
        /* ══════════════════════════════════════════════════════════
           🐛 FIX SCROLL-LOCK MOBILE — causa #1 (PRIMARIA)
           ───────────────────────────────────────────────────────────
           PRIMA: overflowX:'hidden' + overflowY:'visible'.
           Per le specifiche CSS Overflow, se un asse è 'hidden' e l'altro
           è 'visible', il valore 'visible' VIENE FORZATO a 'auto'. Quindi
           overflowY:'visible' diventava di fatto overflowY:'auto' → la
           <section> si trasformava in un CONTENITORE DI SCROLL VERTICALE
           annidato. Su mobile il gesto touch veniva catturato da questo
           scroller interno e la pagina sembrava "bloccarsi/freezarsi"
           dentro la sezione (impossibile scrollarci attraverso).
           DOPO: overflowX:'clip'. Con 'clip' + 'visible' NESSUNO dei due
           valori viene coerciato ('clip' resta 'clip', 'visible' resta
           'visible'): si continua a clippare il marquee in orizzontale
           SENZA creare alcuno scroll container → lo scroll verticale
           nativo/Lenis è di nuovo libero. (Il marquee resta comunque
           auto-contenuto dal suo overflow:hidden.)
           ══════════════════════════════════════════════════════════ */
        overflowX: 'clip',
        overflowY: 'visible',
        borderTop:    `1px solid ${isHacked ? C.alert : C.hair}`,
        borderBottom: `1px solid ${isHacked ? C.alert : C.hair}`,
        transition: 'background-color 0.6s ease, border-color 0.4s ease',
      }}
    >

      {/* ── Scan sweep — riga luminosa che percorre la sezione ── */}
      <div
        className="m-scan-sweep"
        aria-hidden="true"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '2px', zIndex: 100, pointerEvents: 'none',
          background: `linear-gradient(90deg, transparent 0%, ${C.acc} 30%, #fff 50%, ${C.acc} 70%, transparent 100%)`,
          boxShadow: `0 0 16px ${C.acc}, 0 0 32px rgba(244,162,97,0.4)`,
        }}
      />

      {/* ── Blueprint: hairline architettoniche estese (solo desktop) ── */}
      <div className="m-blueprint" aria-hidden="true">
        <span className="m-bp-v1" />
        <span className="m-bp-v2" />
        <span className="m-bp-h1" />
      </div>

      {/* ── Background grid layers ────────────────────────
          Samsung fix: NO mix-blend-mode → plain opacity.
          Due div sovrapposti: il rosso transisce con opacity.
          mix-blend-mode: overlay causa black screen su Samsung
          WebView quando si interseca con GPU composite layers
          durante rapid state changes.
      ─────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      >
        {/* Verde — sempre presente */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(244,162,97,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(244,162,97,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '42px 42px',
        }} />
        {/* Rosso — opacity transition su isHacked, NO mix-blend-mode */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(214,40,40,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(214,40,40,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '42px 42px',
          opacity: isHacked ? 1 : 0,
          transition: 'opacity 0.45s ease',
          /* willChange rimosso: non anima continuamente */
        }} />
      </div>


      {/* ═══════════════════════════════════════════════════
          HEADER BAR — metadati sezione
      ═══════════════════════════════════════════════════ */}
      <div
        className="m-header-bar"
        style={{
          paddingTop: 'clamp(3rem, 8vh, 6rem)',
          paddingLeft: 'clamp(2rem, 5vw, 4rem)',
          paddingRight: 'clamp(2rem, 5vw, 4rem)',
          paddingBottom: 'clamp(1.5rem, 3vh, 2.5rem)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `1px solid ${C.hair}`,
          marginBottom: 0,
          position: 'relative', zIndex: 10,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 'clamp(0.55rem, 0.8vw, 0.7rem)', color: C.mut, letterSpacing: '0.18em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ color: themeColor, transition: 'color 0.4s' }}>◈</span>
          {isHacked ? 'SYS:BREACH / UNAUTHORIZED_ACCESS' : 'SYS:INIT / MANIFESTO_03'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(1rem, 2vw, 2rem)', fontFamily: MONO, fontSize: 'clamp(0.55rem, 0.8vw, 0.7rem)' }}>
          <span style={{ color: C.mut, letterSpacing: '0.12em' }}>
            {isHacked ? 'KERNEL: COMPROMISED' : 'LOC: TORINO_HQ'}
          </span>
          <span style={{
            display: 'flex', gap: '0.3rem', alignItems: 'center',
          }}>
            {['■', '■', '■'].map((dot, i) => (
              <span
                key={i}
                style={{
                  fontSize: '0.45rem',
                  color: isHacked
                    ? (i === 0 ? C.alert : 'rgba(214,40,40,0.35)')
                    : (i === 0 ? C.acc : 'rgba(244,162,97,0.3)'),
                  transition: 'color 0.4s',
                }}
              >{dot}</span>
            ))}
          </span>
        </div>
      </div>


      {/* ═══════════════════════════════════════════════════
          GRID PRINCIPALE
      ═══════════════════════════════════════════════════ */}
      <div className="m-grid">

        {/* ── TITOLO ─────────────────────────────────────── */}
        <div className="m-title-wrap">
          <div style={{ overflow: 'hidden', paddingBottom: '0.15rem' }}>
            <h2
              ref={el => { if (el) titleLinesRef.current[0] = el; }}
              className="m-title-stroked"
              style={{
                margin: 0,
                fontFamily: GROTESK,
                fontWeight: 900,
                lineHeight: 0.88,
                textTransform: 'uppercase',
                letterSpacing: '-0.045em',
                color: 'transparent',
                WebkitTextStroke: `clamp(1px, 0.1vw, 1.5px) ${C.txt}`,
                /* non usare text-stroke su isHacked per ridurre repaint */
              }}
            >
              CREATIVE
            </h2>
          </div>
          <div style={{ overflow: 'hidden', paddingBottom: '0.5rem' }}>
            <h2
              ref={el => { if (el) titleLinesRef.current[1] = el; }}
              className="m-title-solid"
              style={{
                margin: 0,
                fontFamily: GROTESK,
                fontWeight: 900,
                lineHeight: 0.88,
                textTransform: 'uppercase',
                letterSpacing: '-0.045em',
                color: themeColor,
                /* text-shadow via opacity overlay — NO glow neon generico */
                textShadow: isHacked
                  ? '0 0 60px rgba(214,40,40,0.35), 0 0 20px rgba(214,40,40,0.2)'
                  : '0 0 60px rgba(244,162,97,0.2)',
                transition: 'color 0.4s ease, text-shadow 0.4s ease',
              }}
            >
              ARCHITECT.
            </h2>
          </div>

          {/* Metadata inline sotto il titolo */}
          <div className="m-title-meta" style={{
            display: 'flex', alignItems: 'center', gap: 'clamp(0.8rem, 2vw, 2rem)',
            paddingLeft: '0.1em',
            marginTop: 'clamp(0.5rem, 1.2vh, 1rem)',
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 'clamp(0.55rem, 0.75vw, 0.7rem)',
              color: C.mut, letterSpacing: '0.15em', textTransform: 'uppercase',
            }}>
              TORINO — ITALIA
            </span>
            <span style={{ width: 'clamp(1.5rem, 3vw, 4rem)', height: '1px', background: C.hair, display: 'block' }} />
            <span style={{
              fontFamily: MONO, fontSize: 'clamp(0.55rem, 0.75vw, 0.7rem)',
              color: themeColor, letterSpacing: '0.15em', textTransform: 'uppercase',
              transition: 'color 0.4s',
            }}>
              COMPUTER ENGINEERING
            </span>
          </div>
        </div>


        {/* ── IMAGE CARD ─────────────────────────────────────
            isolation: isolate → stacking context proprio.
            Previene che i layer figli interagiscano con
            elementi esterni durante le transizioni rapide
            (Samsung fix secondario).
        ─────────────────────────────────────────────────── */}
        <div
          className="m-image-card"
          style={{
            position: 'relative',
            border: `1px solid ${isHacked ? C.alert : C.hair}`,
            padding: '0.4rem',
            background: 'rgba(0,0,0,0.5)',
            isolation: 'isolate',        /* ← Samsung fix: stacking context pulito */
            transition: 'border-color 0.4s ease',
          }}
        >
          {/* 4 corner markers */}
          {[
            { top: '-1px', left: '-1px',  borderTop: true,    borderLeft: true  },
            { top: '-1px', right: '-1px', borderTop: true,    borderRight: true },
            { bottom: '-1px', left: '-1px',  borderBottom: true, borderLeft: true  },
            { bottom: '-1px', right: '-1px', borderBottom: true, borderRight: true },
          ].map((pos, i) => (
            <div
              key={i}
              ref={el => { if (el) bordersRef.current[i] = el; }}
              style={{
                position: 'absolute',
                width: '12px', height: '12px',
                ...(pos.top    !== undefined && { top:    pos.top }),
                ...(pos.bottom !== undefined && { bottom: pos.bottom }),
                ...(pos.left   !== undefined && { left:   pos.left }),
                ...(pos.right  !== undefined && { right:  pos.right }),
                ...(pos.borderTop    && { borderTop:    `2px solid ${themeColor}` }),
                ...(pos.borderBottom && { borderBottom: `2px solid ${themeColor}` }),
                ...(pos.borderLeft   && { borderLeft:   `2px solid ${themeColor}` }),
                ...(pos.borderRight  && { borderRight:  `2px solid ${themeColor}` }),
                transition: 'border-color 0.4s',
              }}
            />
          ))}

          {/* Overflow wrapper → clip-path reveal */}
          <div
            ref={imageWrapRef}
            style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', cursor: 'crosshair' }}
          >
            {/* Wrapper glitch CSS — separato da GSAP img transform
                Samsung fix: il CSS @keyframes agisce su questo div,
                GSAP (parallax, hover scale) agisce su <img>.
                Due elementi = zero conflitto transform. */}
            <div
              ref={glitchWrapRef}
              className={isHacked ? 'fatal-glitch-active' : ''}
              style={{ width: '100%', height: '100%' }}
            >
              <img
                ref={imageRef}
                src="images/reteNeurale.png"
                alt="System Architecture"
                className="m-parallax-img"
                loading="lazy"
                /* filter gestito SOLO da GSAP (non CSS), per no-conflict */
                style={{ width: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>

            {/* ── Scanlines overlay ────────────────────────
                Samsung fix: NO mix-blend-mode su entrambe.
                mix-blend-mode: overlay + rapid React state
                change + Samsung WebView = black frame render.
                Sostituito con opacity puro + background
                semitrasparente calibrato a mano.
            ─────────────────────────────────────────────── */}
            {/* Verde — sempre */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(244,162,97,0.055) 2px, rgba(244,162,97,0.055) 4px)',
            }} />
            {/* Rosso — opacity 0 → 1 su isHacked */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(214,40,40,0.12) 2px, rgba(214,40,40,0.12) 4px)',
              opacity: isHacked ? 1 : 0,
              transition: 'opacity 0.4s ease',
              /* transform: translateZ(0) rimosso — non serve e crea
                 composite layer extra su device low-end */
            }} />

            {/* Label overlay in basso — info archivio */}
            <div style={{
              position: 'absolute', bottom: '0.8rem', left: '0.9rem',
              fontFamily: MONO, fontSize: 'clamp(0.45rem, 0.65vw, 0.58rem)',
              color: isHacked ? 'rgba(214,40,40,0.7)' : 'rgba(244,162,97,0.5)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              pointerEvents: 'none', zIndex: 5,
              transition: 'color 0.4s',
            }}>
              {isHacked ? 'FILE_CORRUPTED.EXE // 0xFF' : 'SYSTEM_ARCH.PNG // TORINO_2024'}
            </div>

            {/* Index number in alto a destra */}
            <div style={{
              position: 'absolute', top: '0.8rem', right: '0.9rem',
              fontFamily: MONO, fontSize: 'clamp(0.45rem, 0.65vw, 0.58rem)',
              color: isHacked ? 'rgba(214,40,40,0.6)' : 'rgba(244,162,97,0.4)',
              letterSpacing: '0.14em',
              pointerEvents: 'none', zIndex: 5,
              transition: 'color 0.4s',
            }}>
              [03/∞]
            </div>
          </div>
        </div>


        {/* ── TERMINAL BOX ──────────────────────────────── */}
        <div
          ref={terminalRef}
          className="m-terminal"
          style={{
            position: 'relative',
            background: C.bg,
            border: `1px solid ${isHacked ? C.alert : C.hair}`,
            boxShadow: `12px 12px 0px ${isHacked ? 'rgba(214,40,40,0.08)' : 'rgba(244,162,97,0.035)'}`,
            overflow: 'hidden',
            transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
          }}
        >
          {/* Glow magnetico — quickTo in GSAP */}
          <div
            ref={glowRef}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '260px', height: '260px',
              background: `radial-gradient(circle, ${isHacked ? 'rgba(214,40,40,0.18)' : 'rgba(244,162,97,0.12)'} 0%, transparent 70%)`,
              borderRadius: '50%', pointerEvents: 'none',
              opacity: 0, zIndex: 0,
              transform: 'translate(-130px, -130px)',
              transition: 'background 0.4s ease',
            }}
          />

          <div style={{ position: 'relative', zIndex: 10, padding: 'clamp(1.5rem, 3vw, 2.5rem)' }}>

            {/* Header terminale */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: `1px solid ${isHacked ? 'rgba(214,40,40,0.25)' : C.hair}`,
              paddingBottom: '1rem', marginBottom: '1.5rem',
              transition: 'border-color 0.4s',
            }}>
              <span style={{ fontFamily: MONO, fontSize: 'clamp(0.58rem, 0.8vw, 0.68rem)', color: C.mut }}>
                {isHacked ? 'BREACH_TIME:' : 'UPTIME:'}{' '}
                <span
                  ref={uptimeRef}
                  style={{ color: themeColor, fontVariantNumeric: 'tabular-nums', transition: 'color 0.4s' }}
                >
                  00:00:000
                </span>
              </span>
              <span style={{
                fontFamily: MONO, fontSize: 'clamp(0.55rem, 0.75vw, 0.65rem)',
                color: isHacked ? C.alert : C.mut,
                fontWeight: isHacked ? '700' : '400',
                transition: 'color 0.4s, font-weight 0.1s',
              }}>
                {isHacked ? 'STATUS: COMPROMISED' : 'LOC: TORINO_HQ'}
              </span>
            </div>

            {/* Bio */}
            <div style={{
              fontFamily: MONO,
              fontSize: 'clamp(0.78rem, 1vw, 0.95rem)',
              color: C.txt, lineHeight: 1.65, marginBottom: '1.8rem',
            }}>
              <span style={{ color: themeColor, transition: 'color 0.4s' }}>{'>'}</span>{' '}
              Studente di{' '}
              <HoverScramble text="INGEGNERIA INFORMATICA" color={themeColor} />{' '}
              e Creative Developer. Costruisco architetture digitali dove il rigore matematico incontra un'estetica visiva estrema.
            </div>

            {/* Log dinamici */}
            <div
              className="m-terminal-logs"
              style={{
                display: 'flex', flexDirection: 'column', gap: '0.55rem',
                fontFamily: MONO, fontSize: 'clamp(0.62rem, 0.85vw, 0.72rem)',
              }}
            >
              {!isHacked ? (
                <>
                  <div style={{ color: C.mut }}>
                    <span style={{ color: C.acc }}>[+]</span> FRONTEND:{' '}
                    <HoverScramble text="REACT_WEBGL_MATRIX" color={C.txt} /> ... OK
                  </div>
                  <div style={{ color: C.txt }}>
                    <span style={{ color: C.alert }}>[!]</span> BACKEND:{' '}
                    <HoverScramble text="PYTHON_ECOSYSTEM_LINKED" color={C.alert} />
                  </div>
                  <div
                    onClick={handleTapOverride}
                    onTouchStart={handleTapOverride}
                    /* Samsung fix: touch-action manipulation disabilita
                       il double-tap zoom del browser nativamente,
                       eliminando la race condition zoom+state-change
                       che causava il layout nero */
                    style={{
                      color: 'rgba(240,230,211,0.3)',
                      marginTop: '0.5rem',
                      animation: 'mBlink 3s infinite',
                      cursor: 'pointer',
                      userSelect: 'none',
                      touchAction: 'manipulation',  /* ← Samsung fix chiave */
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <span className="m-hide-mobile">[?] AWAITING_CMD: TYPE 'HACK' || 'ROOT' FOR OVERRIDE</span>
                    <span className="m-show-mobile">[?] TAP RAPIDLY ×5 TO OVERRIDE</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: C.alert, animation: 'mBlink 0.2s infinite', fontWeight: '700' }}>
                    [!] FATAL EXCEPTION IN MAIN THREAD
                  </div>
                  <div style={{ color: C.txt, animation: 'mBlink 0.35s infinite reverse' }}>
                    [!] OVERRIDING KERNEL PROTOCOLS...
                  </div>
                  <div style={{ color: 'rgba(240,230,211,0.4)', marginTop: '0.2rem' }}>
                    [✗] SYSTEM INTEGRITY: <span style={{ color: C.alert }}>FAILED</span>
                  </div>
                  <div
                    onClick={handleReboot}
                    style={{
                      color: C.acc,
                      marginTop: '0.5rem',
                      fontWeight: '700',
                      animation: 'mBlink 0.8s infinite',
                      cursor: 'pointer',
                      userSelect: 'none',
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {'>'} PRESS [ESC] OR TAP HERE TO REBOOT
                  </div>
                </>
              )}
            </div>

            {/* Cursore lampeggiante */}
            <div
              className="m-blink-cursor"
              style={{
                width: '8px', height: '14px',
                background: themeColor,
                marginTop: '1.5rem',
                transition: 'background-color 0.4s',
              }}
            />

          </div>
        </div>

      </div>{/* /m-grid */}


      {/* ═══════════════════════════════════════════════════
          MARQUEE
          Mobile fix: overflow:hidden + width:100% sul wrapper
          esterno (display:block) prevengono qualsiasi
          espansione orizzontale del contenuto nowrap.
          Il container interno ha display:flex solo per i track.
      ═══════════════════════════════════════════════════ */}
      <div
        className={`m-marquee-outer${isHacked ? ' m-hacked-marquee' : ''}`}
        style={{
          /* Samsung + mobile fix: overflow hidden sull'outer
             blocca i track nowrap prima che escano dal viewport */
          display: 'block',
          width: '100%',
          overflow: 'hidden',
          borderTop: `1px solid ${isHacked ? C.alert : C.hair}`,
          background: C.bg,
          position: 'relative', zIndex: 20,
          transition: 'border-color 0.4s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            padding: '0.85rem 0',
            /* Non impostare width esplicito qui — eredita dal parent block */
          }}
        >
          {[0, 1].map(i => (
            <div
              key={i}
              className="m-marquee-track"
              style={{
                display: 'flex', whiteSpace: 'nowrap', flexShrink: 0,
                willChange: 'transform',
              }}
            >
              {[
                isHacked ? 'SYSTEM OVERRIDE DETECTED'  : 'COMPUTER ENGINEERING',
                isHacked ? 'CRITICAL FAILURE'          : 'CREATIVE DEVELOPMENT',
                isHacked ? 'UNAUTHORIZED ACCESS'       : 'PYTHON ARCHITECTURE',
                isHacked ? 'KERNEL PANIC: 0x000000EF'  : 'REACT / WEBGL / GSAP',
              ].map((label) => (
                <span
                  key={label}
                  style={{
                    fontFamily: MONO,
                    fontSize: 'clamp(0.6rem, 0.85vw, 0.72rem)',
                    color: isHacked ? C.alert : C.mut,
                    fontWeight: isHacked ? '700' : '400',
                    letterSpacing: '0.18em',
                    paddingRight: '2.5rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2.5rem',
                    transition: 'color 0.4s ease',
                  }}
                >
                  {label}
                  <span style={{ color: themeColor, transition: 'color 0.4s', fontSize: '0.6rem' }}>◈</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>


      {/* ─────────────────────────────────────────────────────
          CSS — layout, animazioni, responsive, reduced-motion
      ───────────────────────────────────────────────────── */}
      <style>{`

        /* ── Cursore lampeggiante ─────────────────────── */
        .m-blink-cursor { animation: mBlink 1s step-end infinite; }
        @keyframes mBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

        /* ── Marquee ─────────────────────────────────── */
        .m-marquee-track { animation: mScrollMarquee 28s linear infinite; }
        @keyframes mScrollMarquee {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }
        .m-hacked-marquee .m-marquee-track { animation-duration: 3.5s !important; }

        /* ── Glitch fatale — su glitchWrapRef, NON su img ─
           CSS transform qui + GSAP transform su img → no conflitto
        ──────────────────────────────────────────────── */
        .fatal-glitch-active {
          animation: mFatalGlitch 0.14s infinite !important;
        }
        @keyframes mFatalGlitch {
          0%   { transform: translate(3px, 1px)   skewX(2deg)  scale(1.04); }
          25%  { transform: translate(-3px, -2px) skewX(-2deg) scale(1.04); }
          50%  { transform: translate(2px, 3px)   skewY(-2deg) scale(1.04); }
          75%  { transform: translate(-2px, -1px) skewY(1deg)  scale(1.04); }
          100% { transform: translate(1px, -2px)               scale(1.04); }
        }

        /* ── Immagine parallax ───────────────────────── */
        .m-parallax-img {
          height: 130%;
          /* filter gestito SOLO da GSAP, non da CSS */
        }

        /* ════════════════════════════════════════════════
           DESKTOP GRID ≥ 992px
        ════════════════════════════════════════════════ */
        @media (min-width: 992px) {
          .m-grid {
            position: relative; z-index: 10;
            max-width: 1440px; margin: 0 auto;
            padding-left:  clamp(2rem, 5vw, 4rem);
            padding-right: clamp(2rem, 5vw, 4rem);
            padding-bottom: clamp(5rem, 12vh, 9rem);
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            grid-template-rows: auto auto;
            column-gap: clamp(0.5rem, 0.8vw, 1rem);
          }

          /* Titolo: full width, overlap aggressivo con immagine */
          .m-title-wrap {
            grid-column: 1 / 13;
            grid-row: 1;
            margin-bottom: -9vw;   /* brutalismo: overlap marcato */
            z-index: 20;
            pointer-events: none;
          }

          /* Image card: col 3/13 → più larga dell'originale */
          .m-image-card {
            grid-column: 3 / 13;
            grid-row: 2;
            z-index: 10;
            aspect-ratio: 16 / 9;
          }

          /* Terminal: col 1/6, invade l'immagine */
          .m-terminal {
            grid-column: 1 / 6;
            grid-row: 2;
            z-index: 30;
            align-self: flex-end;
            margin-bottom: 2rem;
          }

          /* Font size titolo desktop */
          .m-title-stroked,
          .m-title-solid { font-size: clamp(4rem, 13vw, 16rem); }

          /* Metadata titolo: visibile */
          .m-title-meta { display: flex !important; }

          /* show/hide selettivi */
          .m-hide-mobile { display: inline !important; }
          .m-show-mobile { display: none   !important; }
        }


        /* ════════════════════════════════════════════════
           TABLET + MOBILE ≤ 991px
           Riorganizzazione visiva: ordine logico
        ════════════════════════════════════════════════ */
        @media (max-width: 991px) {
          .m-grid {
            display: flex;
            flex-direction: column;
            padding-left:   clamp(1.25rem, 5vw, 2rem);
            padding-right:  clamp(1.25rem, 5vw, 2rem);
            padding-bottom: clamp(2.5rem, 8vh, 5rem);
            gap: 0;
          }

          /* Ordine visivo esplicito */
          .m-title-wrap { order: 1; margin-bottom: 1.5rem; pointer-events: auto; }
          .m-image-card { order: 2; width: 100%; aspect-ratio: 4/3; margin-bottom: 1.5rem; }
          .m-terminal   { order: 3; width: 100%; align-self: auto; margin-bottom: 0; }

          /* Titolo mobile */
          .m-title-stroked,
          .m-title-solid { font-size: clamp(3.5rem, 12vw, 6rem); }

          /* Immagine mobile: altezza auto */
          .m-parallax-img { height: 100%; }

          /* show/hide selettivi */
          .m-hide-mobile { display: none   !important; }
          .m-show-mobile { display: inline !important; }

          /* Terminal: no offset shadow su mobile */
          .m-terminal { box-shadow: none !important; }
        }


        /* ════════════════════════════════════════════════
           SMALL MOBILE ≤ 576px
        ════════════════════════════════════════════════ */
        @media (max-width: 576px) {
          .m-grid {
            padding-left:  1.25rem;
            padding-right: 1.25rem;
          }
          .m-image-card { aspect-ratio: 1/1.05; }
          .m-title-stroked,
          .m-title-solid { font-size: clamp(2.8rem, 14vw, 4.5rem); }
          .m-terminal-logs { font-size: 0.62rem !important; }
          .m-title-meta { display: none !important; } /* nascosta su xs */
        }

        /* ════════════════════════════════════════════════
           EXTRA SMALL ≤ 360px
        ════════════════════════════════════════════════ */
        @media (max-width: 360px) {
          .m-title-stroked,
          .m-title-solid { font-size: 2.6rem; }
          .m-terminal-logs { font-size: 0.58rem !important; gap: 0.4rem !important; }
        }

        /* ════════════════════════════════════════════════
           HOVER (solo device con pointer preciso)
        ════════════════════════════════════════════════ */
        @media (hover: hover) and (pointer: fine) {
          /* Il filter hover è gestito da GSAP (mouseenter/leave),
             non da CSS, per coesistere col parallax GSAP yPercent */
          .m-image-card:hover {
            border-color: rgba(244,162,97,0.4);
          }
          .system-hacked .m-image-card:hover {
            border-color: rgba(214,40,40,0.6);
          }
        }

        /* ════════════════════════════════════════════════
           PREFERS REDUCED MOTION
        ════════════════════════════════════════════════ */
        @media (prefers-reduced-motion: reduce) {
          .m-marquee-track,
          .m-blink-cursor,
          .fatal-glitch-active { animation: none !important; }
          .m-parallax-img { transition: none !important; }
          .m-scan-sweep   { display: none !important; }
        }


        /* ════════════════════════════════════════════════════════════
           ✦ CYBER-LUXURY UPGRADE — blueprint · readout · breach
        ════════════════════════════════════════════════════════════ */

        /* Blueprint architettonico: hairline 1px che attraversano l'intera
           sezione (feel da disegno tecnico). Solo desktop, pointer-events:none
           → ZERO impatto su scroll/touch (non è un layer interattivo). */
        .m-blueprint { display: none; }
        @media (min-width: 992px) {
          .m-blueprint {
            display: block; position: absolute; inset: 0;
            z-index: 1; pointer-events: none;
          }
          .m-blueprint span { position: absolute; background: rgba(240,230,211,0.05); }
          .m-bp-v1 { top: 0; bottom: 0; left:  clamp(2rem, 5vw, 4rem); width: 1px; }
          .m-bp-v2 { top: 0; bottom: 0; right: clamp(2rem, 5vw, 4rem); width: 1px; }
          .m-bp-h1 { left: 0; right: 0; top: 42%; height: 1px; }
        }

        /* Terminal → data-readout di lusso (MAGI / Westworld).
           Decorazioni via pseudo-elementi: l'inline background (shorthand) del box
           non viene toccato (niente conflitti di specificità). */
        .m-terminal::before {                 /* barra accent superiore */
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(244,162,97,0.9) 50%, transparent);
          opacity: 0.7; z-index: 40; pointer-events: none;
          transition: background 0.4s ease;
        }
        .system-hacked .m-terminal::before {
          background: linear-gradient(90deg, transparent, rgba(214,40,40,1) 50%, transparent);
        }
        .m-terminal::after {                  /* texture scanline da readout */
          content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(240,230,211,0.013) 3px, rgba(240,230,211,0.013) 4px);
        }
        .m-terminal-logs > div { letter-spacing: 0.04em; }

        /* ── BREACH: fallimento di sistema profondo ──
           Tipografia corrotta (aberrazione cromatica) + bordi che si
           frantumano via clip-path. Le @keyframes vincono sull'inline
           text-shadow (le animazioni stanno sopra l'inline nel cascade). */
        .system-hacked .m-title-solid {
          animation: mTextCorrupt 0.22s steps(2, jump-none) infinite;
        }
        @keyframes mTextCorrupt {
          0%   { text-shadow: -2px 0 rgba(214,40,40,0.9),  2px 0 rgba(240,230,211,0.55), 0 0 30px rgba(214,40,40,0.4); transform: translateX(0); }
          50%  { text-shadow:  2px 0 rgba(214,40,40,0.9), -2px 0 rgba(240,230,211,0.55), 0 0 30px rgba(214,40,40,0.4); transform: translateX(1px); }
          100% { text-shadow: -1px 0 rgba(214,40,40,0.9),  1px 0 rgba(240,230,211,0.55), 0 0 28px rgba(214,40,40,0.4); transform: translateX(-1px); }
        }
        .system-hacked .m-image-card {
          animation: mBorderShatter 0.16s steps(2, jump-none) infinite;
        }
        @keyframes mBorderShatter {
          0%   { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
          33%  { clip-path: polygon(0 2%, 98% 0, 100% 97%, 2% 100%); }
          66%  { clip-path: polygon(1% 0, 100% 3%, 99% 100%, 0 98%); }
          100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
        }

        /* reduced-motion: spegni anche le nuove animazioni di breach */
        @media (prefers-reduced-motion: reduce) {
          .system-hacked .m-title-solid,
          .system-hacked .m-image-card { animation: none !important; }
        }

      `}</style>
    </section>
  );
}