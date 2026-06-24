// ════════════════════════════════════════════════════════════════════════════
// SEO — SINGLE SOURCE OF TRUTH
// ────────────────────────────────────────────────────────────────────────────
// Questo file è l'UNICA fonte dei metadati SEO/social del sito. Viene usato in
// due posti, così non c'è mai rischio che i tag "a runtime" e quelli "statici"
// vadano fuori sincrono:
//
//   1) src/components/SEO.jsx  → inietta i tag lato client (react-helmet-async),
//      utile per il <title> nel tab, per la navigazione SPA e per Googlebot
//      (che esegue JS).
//   2) scripts/prerender.mjs   → dopo `vite build` scrive un index.html statico
//      per OGNI rotta con questi stessi tag già "cotti" dentro l'HTML, così i
//      crawler social (WhatsApp, Facebook, LinkedIn, Telegram, X…), che NON
//      eseguono JavaScript, vedono titolo/descrizione/immagine corretti.
//
// ⚠️ Le immagini og:image devono essere JPG o PNG (NON AVIF/WEBP: i crawler
//    social non li renderizzano) e idealmente 1200×630px.
// ════════════════════════════════════════════════════════════════════════════

export const SITE = {
  baseUrl: 'https://sebamox.dev',
  name: 'Seba Mollo',
  locale: 'it_IT',
  titleSuffix: 'Seba Mollo',
  defaultTitle: 'Seba Mollo | Sviluppatore Frontend & Backend',
  defaultDescription:
    'Portfolio di Seba Mollo: Sviluppatore Frontend React e Backend Python. Design premium, animazioni interattive e architetture web scalabili.',
  defaultImage: '/images/anteprimaSito.jpg',
};

// `title` = la parte di titolo SPECIFICA della pagina (senza il suffisso, che
// viene aggiunto da buildTitle). `null` → usa SITE.defaultTitle così com'è.
export const ROUTES = {
  '/': {
    title: null,
    description: SITE.defaultDescription,
    image: SITE.defaultImage,
  },
  '/works': {
    title: 'Archivio Progetti',
    description:
      "Esplora l'archivio tecnologico: dai motori 3D custom alle interfacce web premium. Sviluppo Frontend React, Animazioni 3D e Backend Python.",
    image: '/images/portfolio-preview.jpg',
  },
  '/contact': {
    title: 'Contattami | Inizia il tuo progetto',
    description:
      'Hai un progetto in mente? Contattami per discutere di interfacce premium, animazioni 3D e architetture web scalabili con Python e React.',
    image: '/images/contactImage.jpg',
  },
  '/projects/zx-spectrum': {
    title: 'ZX Spectrum AI Engine',
    description:
      "Un algoritmo di ottimizzazione stocastica scritto in C nativo e compilato in WASM, progettato per forzare i limiti hardware degli anni '80.",
    image: '/images/og-zx-spectrum.jpg',
  },
  '/projects/software-3d-engine': {
    title: 'Software 3D Engine | Ingegneria Grafica',
    description:
      "Un motore di rendering 3D CPU-only scritto in C puro. Esplora l'architettura matematica, le proiezioni prospettiche e la rasterizzazione senza l'ausilio di GPU.",
    image: '/images/og-3d-engine.jpg',
  },
  '/projects/aeon-camera': {
    title: 'Haute Horlogerie | Scrubbing Sequence',
    description:
      "Esplora l'assemblaggio di un orologio di lusso (Calibre 7X) tramite una sequenza canvas ultra-fluida a 240 frame sincronizzata allo scroll.",
    image: '/camera-frames/ezgif-frame-120.jpg',
  },
  '/projects/VillaKoi': {
    title: 'villaKoi | Esperienza Web Full-Stack',
    description:
      "villaKoi: case study di un'esperienza web dal respiro Zen. Front-end React con animazioni GSAP ScrollTrigger e backend Python/FastAPI, scalabile e sicuro.",
    image: '/projects/koiSite.avif',
  },
};

// Aggiunge il suffisso del brand al titolo di pagina (o usa il default).
export function buildTitle(title) {
  return title ? `${title} | ${SITE.titleSuffix}` : SITE.defaultTitle;
}

// Rende un path assoluto (og:image e canonical devono essere URL assoluti).
export function toAbsolute(path) {
  if (!path) return '';
  return /^https?:\/\//.test(path) ? path : `${SITE.baseUrl}${path}`;
}

// Risolve i metadati completi e già normalizzati per un percorso, con fallback
// ai default del sito. Usato sia da SEO.jsx che dallo script di prerender.
export function resolveSeo(pathname) {
  const route = ROUTES[pathname] || {};
  const url = `${SITE.baseUrl}${pathname}`;
  return {
    title: buildTitle(route.title ?? null),
    description: route.description ?? SITE.defaultDescription,
    image: toAbsolute(route.image || SITE.defaultImage),
    url,
    canonical: url,
  };
}
