import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/* ScrollTrigger registrato in App.jsx */

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
const C = {
  bg:       '#050302',
  bgDeep:   '#030201',
  accent:   '#F4A261',
  gold:     '#E9C46A',
  text:     '#F0E6D3',
  muted:    'rgba(240,230,211,0.46)',
  faint:    'rgba(240,230,211,0.055)',
  rail:     'rgba(240,230,211,0.065)',
  border:   'rgba(244,162,97,0.12)',
  borderHi: 'rgba(244,162,97,0.45)',
};
const FONT = "'Outfit', 'Geist', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', Menlo, monospace";

/* ─── Percorsi del logo 3D (SOSTITUISCI con i tuoi file reali) ─── */
const LOGO_VIDEO_WEBM = '/videos/videoLogo.webm'; // VP9 + alpha → Chrome/Firefox/Edge
const LOGO_VIDEO_MP4  = '/videos/videoLogo.mp4';  // HEVC + alpha → Safari/iOS

/* ─── Mirino SVG ─── */
function Crosshair({ color = C.accent, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }}>
      <line x1="10" y1="0"  x2="10" y2="7"  stroke={color} strokeWidth="0.9" />
      <line x1="10" y1="13" x2="10" y2="20" stroke={color} strokeWidth="0.9" />
      <line x1="0"  y1="10" x2="7"  y2="10" stroke={color} strokeWidth="0.9" />
      <line x1="13" y1="10" x2="20" y2="10" stroke={color} strokeWidth="0.9" />
      <circle cx="10" cy="10" r="2" stroke={color} strokeWidth="0.9" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STRUTTURA LINKS
   Ogni voce ha: label, href, id (opzionale), external (opzionale).
═══════════════════════════════════════════════════════════════ */
const LINKS = [
  {
    col: 'Social',
    items: [
      {
        label:    'Instagram',
        href:     'https://instagram.com/seba.mollo',
        title:    'Seguimi su Instagram',
        external: true,
      },
      {
        label: 'LinkedIn',
        href:  'https://linkedin.com/in/sebastiano-mollo',
        external: true,
      },
      {
        label: 'Twitter / X',
        href:  'https://x.com/',          // placeholder — sostituire con handle
        external: true,
      },
      {
        label: 'Behance',
        href:  'https://behance.net/',     // placeholder — sostituire con handle
        external: true,
      },
    ],
  },
  {
    col: 'Menu',
    items: [
      { label: 'Work',     href: '#sezione-lavori',  title: 'guarda i miei lavori!', id: 'footer-link-work'     },
      { label: 'Services', href: '#sezione-servizi', title: 'i servizi che offro:',  id: 'footer-link-services' },
      { label: 'Process',  href: '#sezione-process', title: 'trust the process',     id: 'footer-link-process'  },
      { label: 'FAQ',      href: '#faq',             title: 'domande comuni',         id: 'footer-link-faq'      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   FORMATTER OROLOGIO FUORI DAL TICK (istanziato una volta sola)
═══════════════════════════════════════════════════════════════ */
const TIME_FMT = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

export default function Footer() {
  const footerRef      = useRef(null);
  const textWrapperRef = useRef(null);
  const lettersRef     = useRef([]);
  const topRef         = useRef(null);
  const bottomRef      = useRef(null);
  const [time, setTime] = useState('');

  /* ── Orologio locale Italia ── */
  useEffect(() => {
    const tick = () => setTime(`${TIME_FMT.format(new Date())} CET`);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Animazioni GSAP ── */
  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add('(min-width: 768px)', () => {
      const ctx = gsap.context(() => {

        /* Reveal top block */
        if (topRef.current?.children) {
          gsap.fromTo(topRef.current.children,
            { opacity: 0, y: 36, immediateRender: false },
            {
              opacity: 1, y: 0,
              duration: 1.1, stagger: 0.12, ease: 'expo.out',
              scrollTrigger: { trigger: topRef.current, start: 'top 88%' },
            }
          );
        }

        /* Bottom bar reveal */
        if (bottomRef.current) {
          gsap.fromTo(bottomRef.current,
            { opacity: 0, y: 20, immediateRender: false },
            {
              opacity: 1, y: 0,
              duration: 0.9, ease: 'expo.out',
              scrollTrigger: { trigger: bottomRef.current, start: 'top 95%' },
            }
          );
        }

        /* Liquid Magnetic Text */
        const letters = lettersRef.current.filter(Boolean);
        if (!letters.length || !textWrapperRef.current) return;

        const handleMouseMove = (e) => {
          const rect   = textWrapperRef.current.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          letters.forEach((letter) => {
            const lr      = letter.getBoundingClientRect();
            const centerX = (lr.left - rect.left) + lr.width / 2;
            const dist    = Math.abs(mouseX - centerX);
            const maxDist = 280;
            if (dist < maxDist) {
              const intensity = (maxDist - dist) / maxDist;
              gsap.to(letter, {
                y: -48 * intensity, scaleY: 1 + 0.45 * intensity, color: C.gold,
                duration: 0.35, ease: 'power2.out', overwrite: true,
              });
            } else {
              gsap.to(letter, {
                y: 0, scaleY: 1, color: C.accent,
                duration: 0.65, ease: 'elastic.out(1, 0.4)', overwrite: true,
              });
            }
          });
        };

        const handleMouseLeave = () => {
          gsap.to(letters, {
            y: 0, scaleY: 1, color: C.accent,
            duration: 0.8, ease: 'elastic.out(1, 0.3)', stagger: 0.02,
          });
        };

        const wrapper = textWrapperRef.current;
        wrapper.addEventListener('mousemove',  handleMouseMove);
        wrapper.addEventListener('mouseleave', handleMouseLeave);
        return () => {
          wrapper.removeEventListener('mousemove',  handleMouseMove);
          wrapper.removeEventListener('mouseleave', handleMouseLeave);
        };
      }, footerRef);

      return () => ctx.revert();
    });

    /*
      MOBILE GSAP OTTIMIZZATO — animo separatamente topRef e bottomRef
      (niente translateY sull'intero footer → nessun CLS su iOS). Su mobile
      il liquid text non serve (gestito dal matchMedia desktop).
    */
    mm.add('(max-width: 767px)', () => {
      const ctx = gsap.context(() => {
        const targets = [topRef.current, bottomRef.current].filter(Boolean);
        if (!targets.length) return;
        gsap.fromTo(targets,
          { opacity: 0, y: 24, immediateRender: false },
          {
            opacity: 1, y: 0, duration: 0.95, ease: 'expo.out',
            stagger: 0.15,
            scrollTrigger: { trigger: footerRef.current, start: 'top 85%' },
          }
        );
      }, footerRef);
      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  const headline = "LET'S TALK";

  /* ── Intercetta i link interni per lo Smooth Scroll ── */
  const handleInternalLink = (e, href, external) => {
    // Se è un link esterno (es. Instagram), lascia fare al browser
    if (external || !href.startsWith('#')) return;

    e.preventDefault(); // Blocca il "salto" in cima e l'aggiornamento dell'URL

    const targetId = href.substring(1); // Rimuove il '#'
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      if (window.__lenis) {
        // Se Lenis è attivo (Desktop), usa il suo motore per scrollare
        window.__lenis.scrollTo(targetElement, { duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
      } else {
        // Fallback per Mobile (dove Lenis potrebbe essere disabilitato)
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      console.warn(`Elemento con ID "${targetId}" non trovato nella pagina.`);
    }
  };

  return (
    <footer
      ref={footerRef}
      className="awwwards-footer"
      style={{
        position: 'relative',
        background: C.bgDeep,
        borderTop: `1px solid ${C.faint}`,
        overflow: 'hidden',
      }}
    >

      {/* Glow ambientale */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 90% 45% at 50% 0%, rgba(244,162,97,0.055) 0%, transparent 70%)`,
      }} />

      {/* Linee verticali di precisione */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        display: 'flex', justifyContent: 'space-between',
        padding: '0 clamp(1rem, 4vw, 4.5rem)',
      }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            width: '1px', background: C.rail, height: '100%',
            opacity: i === 1 || i === 4 ? 1 : 0.45,
          }} />
        ))}
      </div>

      {/* Mirini angolari */}
      <div style={{ position: 'absolute', top: '1.2rem',    left: '1.2rem',    zIndex: 2, opacity: 0.35 }}><Crosshair size={16} /></div>
      <div style={{ position: 'absolute', top: '1.2rem',    right: '1.2rem',   zIndex: 2, opacity: 0.35 }}><Crosshair size={16} /></div>
      <div style={{ position: 'absolute', bottom: '1.2rem', left: '1.2rem',    zIndex: 2, opacity: 0.2  }}><Crosshair size={14} /></div>
      <div style={{ position: 'absolute', bottom: '1.2rem', right: '1.2rem',   zIndex: 2, opacity: 0.2  }}><Crosshair size={14} /></div>

      {/* ══ CONTENUTO PRINCIPALE ══ */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: 'clamp(3.5rem, 8vw, 8rem) clamp(1.5rem, 5vw, 5rem) 0',
        maxWidth: '1400px', margin: '0 auto',
      }}>

        {/* ── PARTE SUPERIORE: CTA + Link ── */}
        <div
          ref={topRef}
          className="footer-top"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 'clamp(2rem, 6vw, 6rem)',
            paddingBottom: 'clamp(1.5rem, 2vw, 2rem)',
            borderBottom: `1px solid ${C.faint}`,
          }}
        >
          {/* CTA sinistro */}
          <div style={{ maxWidth: '520px', minWidth: 0 }}>
            <p style={{
              fontFamily: MONO, fontSize: '0.68rem', color: C.accent,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              marginBottom: '1.5rem',
              display: 'flex', alignItems: 'center', gap: '0.7rem',
            }}>
              <Crosshair color={C.accent} size={12} />
              [ CONTATTI DIRETTI ]
            </p>

            <h3 style={{
              fontFamily: FONT, fontWeight: 900,
              fontSize: 'clamp(1.6rem, 3.5vw, 3.2rem)',
              color: C.text, letterSpacing: '-0.035em',
              lineHeight: 1.05, margin: '0 0 1.25rem',
            }}>
              Hai un'idea audace?<br />
              <em style={{ fontStyle: 'normal', color: C.gold }}>Costruiamola.</em>
            </h3>

            <p style={{
              fontFamily: FONT,
              fontSize: 'clamp(0.88rem, 1.15vw, 1rem)',
              color: C.muted, lineHeight: 1.72,
              margin: '0 0 2.5rem', maxWidth: '44ch',
            }}>
              Pronto a trasformare il tuo concept in un'esperienza digitale ad alte
              prestazioni? Scrivimi — rispondo entro 24h.
            </p>

            <a
              href="mailto:sebamoxdev@gmail.com"
              className="footer-btn"
              aria-label="Avvia un progetto — invia una email a sebamoxdev@gmail.com"
              style={{
                display: 'inline-flex', alignItems: 'center',
                gap: 'clamp(0.5rem, 1.2vw, 0.75rem)',
                padding: 'clamp(0.85rem, 1.5vw, 1.2rem) clamp(1.4rem, 2.8vw, 3rem)',
                maxWidth: 'calc(100vw - 3rem)',
                background: C.accent, borderRadius: '0.2rem',
                fontFamily: FONT,
                fontSize: 'clamp(0.82rem, 1.8vw, 1rem)',
                fontWeight: 700,
                color: C.bgDeep, textDecoration: 'none',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                transition: 'transform 0.45s cubic-bezier(0.16,1,0.3,1), box-shadow 0.45s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Crosshair color={C.bgDeep} size={14} />
              Avvia un Progetto
              <span aria-hidden style={{ fontFamily: MONO, fontSize: '0.7rem', opacity: 0.6, letterSpacing: '0.05em' }}>↗</span>
            </a>
          </div>

          {/* ── Colonne link ── */}
          <div className="footer-links-grid" style={{
            display: 'flex',
            gap: 'clamp(2rem, 5vw, 5rem)',
            flexWrap: 'wrap',
          }}>
            {LINKS.map(({ col, items }) => (
              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <span style={{
                  fontFamily: MONO, fontSize: '0.62rem', color: C.muted,
                  letterSpacing: '0.16em', textTransform: 'uppercase',
                  marginBottom: '0.25rem',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}>
                  <span style={{ display: 'inline-block', width: '1rem', height: '1px', background: C.muted, opacity: 0.5 }} />
                  {col}
                </span>

                {items.map(({ label, href, title, external, id }) => (
                  <a
                    key={label}
                    href={href}
                    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    {...(title ? { title } : {})}
                    {...(id ? { id } : {})}
                    onClick={(e) => handleInternalLink(e, href, external)}
                    className="footer-link"
                    style={{
                      fontFamily: FONT,
                      fontSize: 'clamp(0.9rem, 1.6vw, 1rem)',
                      fontWeight: 500,
                      color: C.text, textDecoration: 'none',
                      transition: 'color 0.3s ease, transform 0.3s ease, letter-spacing 0.3s ease',
                      display: 'inline-block',
                    }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            PARTE CENTRALE — "LET'S TALK" + LOGO 3D
            Layout flex: testo gigante a sinistra (occupa la maggior parte
            dello spazio), blocco video del logo a destra. Su mobile la riga
            si impila (column-reverse): prima video+didascalia centrati, poi
            "LET'S TALK" a tutta larghezza. Vedi media query nel <style>.
        ══════════════════════════════════════════════════════════ */}
        <div
          className="footer-talk-row"
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'clamp(1.5rem, 4vw, 3.5rem)',
            width: '100%',
            padding: 'clamp(1.0rem, 1.5vw, 1.5rem) 0',
            borderBottom: `1px solid ${C.faint}`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Griglia verticale sottile — texture brutalista */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
            backgroundImage: `repeating-linear-gradient(
              90deg,
              ${C.faint} 0, ${C.faint} 1px,
              transparent 1px, transparent 80px
            )`,
            opacity: 0.6,
          }} />

          {/* Testo liquido gigante (magnetico su desktop) */}
          <div
            ref={textWrapperRef}
            className="footer-liquid-wrapper"
            style={{
              flex: '1 1 auto',
              minWidth: 0,                 // permette al flex item di restringersi: niente overflow
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
              flexWrap: 'nowrap',
              cursor: 'crosshair',
              perspective: '1000px',
              userSelect: 'none',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {headline.split('').map((char, i) => (
              <span
                key={i}
                ref={el => { lettersRef.current[i] = el; }}
                className="footer-liquid-char"
                style={{
                  fontFamily: FONT, fontWeight: 900,
                  // Font fluido ridotto (rispetto all'originale) per far posto al
                  // video senza sbordare. Cap a 10rem: resta enorme ma contenuto.
                  fontSize: 'clamp(3rem, 9vw, 10rem)',
                  color: C.accent,
                  lineHeight: 0.85,
                  letterSpacing: '-0.04em',
                  display: 'inline-block',
                  willChange: 'transform, color',
                  transformOrigin: 'bottom center',
                  whiteSpace: 'pre',
                }}
              >
                {char}
              </span>
            ))}
          </div>

          {/* Blocco logo 3D + didascalia */}
          <div
            className="footer-logo-block"
            style={{
              flex: '0 0 auto',
              width: 'clamp(140px, 16vw, 210px)',  // contenuto, mai enorme
              maxWidth: '210px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.65rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/*
              LOGO 3D — tag <video> NATIVO, nessuna libreria esterna.
              · autoPlay + muted + playsInline → autoplay garantito su Safari/iOS
                (senza muted i browser mobile bloccano la riproduzione automatica).
              · loop → riproduzione continua.
              · preload="metadata" → scarica solo le dimensioni, non l'intero file,
                finché il video non parte: peso iniziale minimo.
              · pointer-events:none → il video non intercetta click/hover.
              Per la TRASPARENZA reale servono due encoding (il browser sceglie il
              primo <source> che sa decodificare):
                · .webm  (VP9 + canale alpha)  → Chrome / Firefox / Edge
                · .mp4   (HEVC + canale alpha)  → Safari / iOS
              Suggerimento: per un fallback in iOS Low-Power Mode (che blocca
              l'autoplay) puoi aggiungere poster="/assets/logo-3d-poster.webp".
            */}
            <video
              className="footer-logo-video"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                pointerEvents: 'none',
                background: 'transparent',
              }}
            >
              <source src={LOGO_VIDEO_WEBM} type="video/webm" />
              <source src={LOGO_VIDEO_MP4} type="video/mp4" />
            </video>

            {/* Didascalia tecnica/hacker — monospace, micro, grigio attenuato */}
            <span
              className="footer-logo-caption"
              style={{
                fontFamily: MONO,
                fontSize: '10px',
                color: C.muted,
                opacity: 0.5,
                letterSpacing: '0.06em',
                lineHeight: 1.45,
                textAlign: 'center',
                whiteSpace: 'normal',
              }}
            >
              logo 3D realizzato interamente in spline
            </span>
          </div>
        </div>

        {/* ── PARTE INFERIORE: Status + Geo + Copyright ── */}
        <div
          ref={bottomRef}
          className="footer-bottom"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.5rem',
            padding: 'clamp(1.5rem, 3vw, 2.5rem) 0 clamp(2rem, 4vw, 4rem)',
          }}
        >
          {/* Dot disponibilità */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.4rem 1rem 0.4rem 0.6rem',
            border: `1px solid ${C.border}`,
            borderRadius: '0.15rem',
            background: 'rgba(244,162,97,0.04)',
            flexShrink: 0,
          }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: '#4CAF50', boxShadow: '0 0 8px #4CAF50',
              animation: 'footerPulse 2.2s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: MONO, fontSize: '0.62rem', color: C.text,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              DISPONIBILE — NUOVI PROGETTI
            </span>
          </div>

          {/* Coordinate + orologio */}
          <div
            className="footer-coords"
            style={{
              display: 'flex', alignItems: 'center',
              gap: 'clamp(0.75rem, 2vw, 1.5rem)',
              fontFamily: MONO, fontSize: '0.62rem', color: C.muted,
              letterSpacing: '0.08em',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>44°2′N 7°52′E — CUNEO, IT</span>
            <span className="footer-coord-sep" style={{
              display: 'inline-block', width: '1px', height: '0.8rem', background: C.rail,
            }} />
            <span style={{ color: C.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {time}
            </span>
          </div>

          {/* Copyright */}
          <div style={{
            fontFamily: MONO, fontSize: '0.6rem', color: C.muted,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>
            © {new Date().getFullYear()} SEBASTIANO MOLLO
            <span style={{
              display: 'inline-block', width: '1rem', height: '1px',
              background: C.muted, opacity: 0.4,
              verticalAlign: 'middle', margin: '0 0.6rem',
            }} />
            <a href="#" className="footer-legal"
              style={{ color: C.muted, textDecoration: 'none', transition: 'color 0.3s ease' }}>
              PRIVACY
            </a>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Safety net posizionamento ── */
        .awwwards-footer {
          position: relative !important;
          height: auto !important;
        }

        /* ── Hover desktop only ── */
        @media (hover: hover) and (pointer: fine) {
          .footer-link:hover {
            color: ${C.accent} !important;
            transform: translateX(6px) !important;
          }
          .footer-btn:hover {
            transform: translateY(-3px) scale(1.02) !important;
            box-shadow:
              0 0 0 2px ${C.bgDeep},
              0 0 0 4px ${C.accent},
              0 28px 56px rgba(244,162,97,0.32) !important;
          }
          .footer-legal:hover {
            color: ${C.text} !important;
          }
        }

        @keyframes footerPulse {
          0%,100% { opacity: 1;   transform: scale(1);    }
          50%      { opacity: 0.5; transform: scale(1.3); }
        }

        /* ════════════════════════════════════════════════════════
           MOBILE RESPONSIVE — < 768px
        ════════════════════════════════════════════════════════ */
        @media (max-width: 767px) {
          .awwwards-footer { position: relative !important; height: auto !important; }

          /*
            BOTTOM SECTION (talk row) — impilamento.
            column-reverse: il blocco video (secondo nel DOM) sale IN ALTO,
            "LET'S TALK" (primo nel DOM) resta sotto, a tutta larghezza.
            Mantiene l'ordine DOM "naturale" (heading prima) per SEO/a11y.
          */
          .footer-talk-row {
            flex-direction: column-reverse !important;
            align-items: center !important;
            gap: clamp(1.75rem, 6vw, 2.5rem) !important;
            text-align: center !important;
          }
          .footer-liquid-wrapper {
            justify-content: center !important;
            width: 100% !important;
          }
          .footer-logo-block {
            width: clamp(150px, 48vw, 200px) !important;
            max-width: 200px !important;
          }

          /*
            LIQUID TEXT — su mobile il testo è a tutta larghezza (video sopra),
            quindi può tornare più grande riempiendo la riga.
            clamp(2.4rem, 12vw, 18rem): a 375px → 12vw=45px → "LET'S TALK" ≈ 247px
            < 375px disponibili ✓ (nessun overflow orizzontale).
          */
          .footer-liquid-char {
            font-size: clamp(2.4rem, 12vw, 18rem) !important;
          }

          .footer-bottom {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 1.1rem !important;
          }

          .footer-coord-sep {
            display: none !important;
          }

          .footer-top {
            flex-direction: column !important;
          }

          .footer-links-grid {
            gap: 2rem !important;
          }
        }

        /* ── Tablet stretto (480-767px) ── */
        @media (min-width: 480px) and (max-width: 767px) {
          .footer-top {
            flex-direction: row !important;
            flex-wrap: wrap !important;
          }
          .footer-liquid-char {
            font-size: clamp(3rem, 12vw, 18rem) !important;
          }
        }

        /*
          MICRO SCREEN < 320px — font liquido a 10vw per garantire che
          "LET'S TALK" stia sempre dentro: a 280px → 10vw=28px × ~5.5em ≈ 154px ✓.
        */
        @media (max-width: 319px) {
          .footer-liquid-char {
            font-size: clamp(1.8rem, 10vw, 18rem) !important;
          }
          .footer-links-grid {
            flex-direction: column !important;
            gap: 1.5rem !important;
          }
          .footer-btn {
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }
        }

        /* ── Schermi micro legacy (320-359px) ── */
        @media (max-width: 359px) and (min-width: 320px) {
          .footer-liquid-char {
            font-size: clamp(2rem, 11vw, 18rem) !important;
          }
          .footer-links-grid {
            flex-direction: column !important;
            gap: 1.5rem !important;
          }
        }
      `}</style>
    </footer>
  );
}