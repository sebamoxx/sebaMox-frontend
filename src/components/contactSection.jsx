import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/* ═══════════════════════════════════════════════════════════════
   CONTACT SECTION — Mobile-Fixed & Scroll-Optimized
   
   Modifiche rispetto all'originale:
   ① overflowX clip: wrapper esterno con overflowX:'hidden' isola il
     marquee senza toccare la section → il bottone magnetico non viene mai
     clippato perché si trova dentro la section, non fuori dal wrapper
   ② Marquee container: aggiunto transform:'translateZ(0)' → forza un
     compositor layer GPU su Safari iOS, risolvendo il bug per cui
     overflow:hidden su elementi absolutely-positioned non clippa davvero
   ③ Marquee font: clamp(5rem,20vw,24rem) → clamp(2.5rem,12vw,22rem)
     Il minimo scende a 2.5rem (≈40px) → su 375px si vedono parole intere
   ④ Section padding: clamp(8rem,18vw,18rem) → clamp(4rem,12vw,18rem)
     8rem di minimo su 320px era 128px TOP + 128px BOTTOM = spazio sprecato
   ⑤ h2 font: clamp(3rem,10vw,9rem) → clamp(2rem,9vw,9rem)
     Previene overflow di "Facciamo qualcosa" su schermi a 320px
   ⑥ ScrollTrigger: aggiunto invalidateOnRefresh:true → ricalcola pin e
     posizioni al resize/orientamento senza layout jump su mobile
   ⑦ Marquee wrapper width: da '200%' a 'max-content' → il flex container
     si dimensiona al contenuto reale, niente overflow implicito da calcolo %
═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   ATOM 1: CYBER BACKGROUND (Grid + Scanlines + Vignette)
   Invariato — nessun bug qui.
═══════════════════════════════════════════════════════════════ */
function CyberBackground() {
  return (
    <>
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: C.accent,
        backgroundImage: [
          'radial-gradient(circle, rgba(5,3,2,0.15) 1px, transparent 1px)',
          'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(5,3,2,0.25) 100%)',
        ].join(', '),
        backgroundSize: '24px 24px, 100% 100%',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent, transparent 3px,
          rgba(5,3,2,0.035) 3px, rgba(5,3,2,0.035) 4px
        )`,
      }} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ATOM 2: ENDLESS MARQUEE SCROLL (ScrollTrigger Ottimizzato)
═══════════════════════════════════════════════════════════════ */
function EndlessMarquee({ sectionRef }) {
  const marqueeRef = useRef(null);

  useEffect(() => {
    const el = marqueeRef.current;
    if (!el || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.to(el, {
        xPercent: -25,
        ease: 'none',
        force3D: true,
        scrollTrigger: {
          trigger: sectionRef.current,
          scrub: 1.2,
          start: 'top bottom',
          end: 'bottom top',
          /* ⑥ invalidateOnRefresh: true → al resize (orientamento mobile,
             barra URL Safari) ScrollTrigger ricalcola start/end/pin senza
             produrre un layout jump o un salto brusco nell'animazione scrub */
          invalidateOnRefresh: true,
          onEnter:     () => { el.style.willChange = 'transform'; },
          onLeave:     () => { el.style.willChange = 'auto'; },
          onEnterBack: () => { el.style.willChange = 'transform'; },
          onLeaveBack: () => { el.style.willChange = 'auto'; },
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [sectionRef]);

  return (
    /*  ② Il wrapper ha già overflow:hidden + position:absolute (corretto).
        Bug iOS Safari: overflow:hidden su elementi absolutely-positioned
        non clippa i figli durante il compositing GPU → si vede il marquee
        scorrere fuori dai bordi della section su scroll veloce.
        Fix: transform:'translateZ(0)' promuove questo div su un layer
        compositor indipendente → Safari rispetta il clipping nel proprio
        layer, risolvendo il bug senza toccare il resto del layout.        */
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, zIndex: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      /* ② iOS Safari overflow:hidden compositor-layer fix */
      transform: 'translateZ(0)',
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: 0,
        transform: 'translateY(-50%)',
        /*  ⑦ Rimosso width:'200%' — il flex container si dimensiona al
            contenuto reale (max-content). Con width:'200%', il div veniva
            forzato a 200vw: se il testo era più largo, overflowava il
            contenitore generando un rettangolo di larghezza incoerente che
            alcuni browser consideravano nel calcolo dello scroll-width.
            Con max-content il div è esattamente largo quanto il suo contenuto
            e il transform:translateZ(0) del genitore garantisce il clip.     */
        width: 'max-content',
        display: 'flex',
        opacity: 0.08,
      }}>
        <div ref={marqueeRef} style={{
          display: 'flex',
          gap: '3rem',
          whiteSpace: 'nowrap',
          fontFamily: FONT,
          fontWeight: 900,
          /*  ③ Font size marquee — PRIMA: clamp(5rem, 20vw, 24rem)
              Problema: il minimo di 5rem = 80px. Su 375px (iPhone 14)
              20vw = 75px < 80px → usava 80px. Ogni carattere risultava
              ~48px di larghezza effettiva → si vedevano solo frammenti di
              lettere, nessuna parola leggibile = "muro" incomprensibile.

              DOPO: clamp(2.5rem, 12vw, 22rem)
              Su 375px: 12vw = 45px → min 2.5rem = 40px. "LET'S BUILD ◈"
              (~11 char × 24px) = ~264px → circa 0.7 volte la viewport:
              si vede una parola per volta in transizione, impatto visivo
              mantenuto. Su 768px+: 12vw = 92px → testo grande e scenico.   */
          fontSize: 'clamp(2.5rem, 12vw, 22rem)',
          lineHeight: 0.8,
          color: C.bg,
        }}>
          <span>LET'S BUILD ◈</span>
          <span style={{ color: 'transparent', WebkitTextStroke: `2px ${C.bg}` }}>PREMIUM FRONTEND ◈</span>
          <span>SCALABLE PYTHON BACKEND ◈</span>
          <span style={{ color: 'transparent', WebkitTextStroke: `2px ${C.bg}` }}>LET'S BUILD ◈</span>
          <span>PREMIUM FRONTEND ◈</span>
          {/* Span extra: serve a riempire il gap quando il font è piccolo su mobile */}
          <span>SCALABLE PYTHON BACKEND ◈</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ATOM 3: MAGNETIC CTA BUTTON
   Invariato — già ben gestito per mobile (maxWidth, clamp padding,
   wordBreak fallback, handler touch). Nessun bug qui.
═══════════════════════════════════════════════════════════════ */
function MagneticCTA({ audio }) {
  const btnRef   = useRef(null);
  const arrowRef = useRef(null);
  const [hov, setHov] = useState(false);

  const handleEnter = useCallback(() => {
    audio?.tick?.();
    setHov(true);
    const arrow = arrowRef.current;
    if (!arrow) return;
    gsap.killTweensOf(arrow);
    gsap.to(arrow, {
      x: 12, y: -12, opacity: 0,
      duration: 0.18, ease: 'power2.in',
      onComplete: () => {
        gsap.set(arrow, { x: -12, y: 12 });
        gsap.to(arrow, { x: 0, y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
      },
    });
  }, [audio]);

  const handleLeave = useCallback(() => {
    setHov(false);
    const arrow = arrowRef.current;
    if (!arrow) return;
    gsap.killTweensOf(arrow);
    gsap.to(arrow, { x: 0, y: 0, opacity: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
  }, []);

  const handlePress = useCallback(() => audio?.beep?.(), [audio]);

  const handleTouch = useCallback(() => {
    audio?.tick?.();
    setTimeout(() => audio?.beep?.(), 90);
  }, [audio]);

  return (
    <div ref={btnRef} className="magnetic-wrapper" style={{ display: 'inline-block', maxWidth: '100%' }}>
      <Link
        to="/contact"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onMouseDown={handlePress}
        onTouchStart={handleTouch}
        style={{
          display: 'inline-flex', alignItems: 'center',
          gap: 'clamp(0.5rem, 1.5vw, 1rem)',
          padding: 'clamp(1rem, 2.5vw, 1.8rem) clamp(1.2rem, 3.5vw, 4.5rem)',
          maxWidth: 'calc(100vw - 3rem)',
          background: hov ? 'transparent' : C.bg,
          border: `2px solid ${hov ? C.bg : 'transparent'}`,
          borderRadius: '0.2rem',
          fontSize: 'clamp(0.75rem, 4vw, 1.2rem)',
          fontFamily: FONT, fontWeight: 700,
          color: hov ? C.bg : C.accent,
          textDecoration: 'none', letterSpacing: '0.03em',
          transition: 'background 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: hov
            ? '0 0 0 4px rgba(5,3,2,0.1), 0 24px 48px rgba(5,3,2,0.25)'
            : '0 8px 32px rgba(5,3,2,0.15)',
          cursor: 'pointer',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <Crosshair color={hov ? C.bg : C.accent} size={16} style={{ flexShrink: 0 }} />
        <span style={{ minWidth: 0, wordBreak: 'break-all' }}>
          Fissa una call!
        </span>
        <span ref={arrowRef} style={{
          fontFamily: MONO,
          fontSize: 'clamp(0.8rem, 1.5vw, 1rem)',
          color: hov ? C.bg : C.muted,
          display: 'inline-block', willChange: 'transform',
          flexShrink: 0, marginLeft: '0.2rem',
          transition: 'color 0.35s ease',
        }}>
          ↗
        </span>
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ORGANISM: CONTACT SECTION MAIN
═══════════════════════════════════════════════════════════════ */
export default function ContactSection({ audio }) {
  const sectionRef = useRef(null);

  return (
    /*  ① WRAPPER per il clip orizzontale del marquee.
        Strategia: mettere overflowX:'hidden' sul WRAPPER esterno invece
        che sulla <section> risolve il bug di scroll orizzontale in modo
        chirurgico senza effetti collaterali:

        — La <section> resta senza overflow → il bottone magnetico può
          muoversi liberamente senza essere clippato
        — Il wrapper è full-width → il bottone (centrato) non toccherà
          mai i bordi orizzontali anche con l'effetto magnetico (±20px)
        — overflowX:'hidden' (non 'clip') per massima compatibilità
          incluso Safari iOS < 16 che non supporta overflow:clip
        — Il wrapper non è il trigger ScrollTrigger → nessun conflitto
          con start/end calculation di GSAP                              */
    <div style={{ overflowX: 'hidden', position: 'relative' }}>
      <section
        id = "contact-section"
        ref={sectionRef}
        className="awwwards-contact"
        style={{
          /*  ④ Padding verticale — PRIMA: clamp(8rem, 18vw, 18rem)
              Su 320px: 18vw = 57.6px < 8rem = 128px → usava 8rem.
              128px top + 128px bottom = 256px solo di padding = spazio
              enorme su uno schermo da 568px di altezza (iPhone SE).

              DOPO: clamp(4rem, 12vw, 18rem)
              Su 320px: 12vw = 38.4px < 4rem = 64px → usa 4rem = 64px.
              64px top + 64px bottom = 128px (la metà) → molto più ragionevole.
              Su 768px: 12vw = 92px ≈ 5.75rem → spazio generoso come da design.
              Su 1440px: 12vw = 172px → max 18rem = 288px → invariato.           */
          padding: 'clamp(4rem, 12vw, 18rem) 0',
          textAlign: 'center',
          position: 'relative',
          /* Nessun overflow qui: il bottone magnetico può spostarsi liberamente */
        }}
      >
        <CyberBackground />
        <EndlessMarquee sectionRef={sectionRef} />

        <div style={{ position: 'relative', zIndex: 5, padding: '0 1.5rem' }}>

          <p style={{
            fontFamily: MONO, fontSize: '0.7rem',
            color: 'rgba(5,3,2,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase',
            marginBottom: '2.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem',
          }}>
            <Crosshair color="rgba(5,3,2,0.5)" size={12} />
            [ 05 / AVVIA PROGETTO ]
          </p>

          {/*  ⑤ h2 font-size — PRIMA: clamp(3rem, 10vw, 9rem)
               Su 320px con padding 0 1.5rem: area testo = 320 - 48 = 272px.
               3rem = 48px. "Facciamo qualcosa" ha 17 caratteri → a 48px
               ogni char ≈ 29px → 17 × 29 = 493px. Overflow di 221px.

               DOPO: clamp(2rem, 9vw, 9rem)
               Su 320px: 9vw = 28.8px → min 2rem = 32px.
               17 char × 32px × 0.58 (Outfit 900 width ratio) ≈ 316px.
               Con il <br /> il testo si divide in due righe di ~8-9 char
               → ogni riga ≈ 149px. Nessun overflow, testo sempre leggibile.
               Su 768px: 9vw = 69px ≈ 4.3rem → impattante.
               Su 1440px: 9vw = 130px → max 9rem = 144px → invariato.          */}
          <h2 style={{
            fontFamily: FONT, fontWeight: 900,
            fontSize: 'clamp(2rem, 9vw, 9rem)',
            letterSpacing: '-0.04em', lineHeight: 0.9,
            color: C.bg, marginBottom: 'clamp(3.5rem, 8vw, 6rem)',
            textShadow: '0 10px 30px rgba(5,3,2,0.1)',
          }}>
            Facciamo qualcosa<br />di straordinario.
          </h2>
          <MagneticCTA audio={audio} />

          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
            marginTop: 'clamp(3rem, 5vw, 4rem)',
          }}>
            <p style={{
              fontFamily: MONO, fontSize: '0.65rem',
              color: 'rgba(5,3,2,0.45)', letterSpacing: '0.15em', textTransform: 'uppercase',
              margin: 0, userSelect: 'none',
            }}>
              Rispondo entro 24h ◈ Operativo worldwide
            </p>
          </div>

        </div>
      </section>
    </div>
  );
}