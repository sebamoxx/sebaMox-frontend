// ════════════════════════════════════════════════════════════════════════════
// PRERENDER DEI META TAG SEO/SOCIAL
// ────────────────────────────────────────────────────────────────────────────
// Gira DOPO `vite build`. Per ogni rotta definita in src/seo.config.js prende
// il dist/index.html prodotto da Vite, sostituisce il segnaposto
// <!-- SEO_PLACEHOLDER --> con i meta tag specifici di quella rotta, e scrive:
//
//     /                              -> dist/index.html
//     /works                         -> dist/works/index.html
//     /projects/zx-spectrum          -> dist/projects/zx-spectrum/index.html
//     ...
//
// Così i crawler social (WhatsApp, Facebook, LinkedIn, Telegram, X), che NON
// eseguono JavaScript, ricevono un HTML con titolo/descrizione/immagine già
// dentro. Su Vercel i file statici hanno priorità sul rewrite catch-all, quindi
// /works serve dist/works/index.html (e non il fallback /index.html).
//
// NB: non usiamo un browser headless (Puppeteer) di proposito — qui serve solo
// il <head>, e il sito è pesante (Three.js/Spline/WebGL): un crawl headless
// sarebbe lento e fragile. Iniettare i tag staticamente è più affidabile.
// ════════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTES, resolveSeo, SITE } from '../src/seo.config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'dist');
const PLACEHOLDER = '<!-- SEO_PLACEHOLDER -->';

// Escape minimale per i valori dentro gli attributi HTML.
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function metaBlock(seo) {
  return [
    `<title>${esc(seo.title)}</title>`,
    `<meta name="description" content="${esc(seo.description)}" />`,
    `<link rel="canonical" href="${esc(seo.url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE.name)}" />`,
    `<meta property="og:locale" content="${esc(SITE.locale)}" />`,
    `<meta property="og:title" content="${esc(seo.title)}" />`,
    `<meta property="og:description" content="${esc(seo.description)}" />`,
    `<meta property="og:url" content="${esc(seo.url)}" />`,
    `<meta property="og:image" content="${esc(seo.image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(seo.description)}" />`,
    `<meta name="twitter:image" content="${esc(seo.image)}" />`,
  ].join('\n    ');
}

let template;
try {
  template = readFileSync(join(distDir, 'index.html'), 'utf-8');
} catch {
  console.error('[prerender] dist/index.html non trovato. Esegui prima `vite build`.');
  process.exit(1);
}

if (!template.includes(PLACEHOLDER)) {
  console.error(`[prerender] Segnaposto "${PLACEHOLDER}" assente in index.html. Aborto.`);
  process.exit(1);
}

let count = 0;
for (const pathname of Object.keys(ROUTES)) {
  const seo = resolveSeo(pathname);
  const html = template.replace(PLACEHOLDER, metaBlock(seo));
  const outFile =
    pathname === '/'
      ? join(distDir, 'index.html')
      : join(distDir, pathname, 'index.html');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html, 'utf-8');
  console.log(`[prerender] ${pathname}  →  ${outFile.replace(distDir, 'dist')}`);
  count++;
}

console.log(`[prerender] OK — ${count} pagine con meta tag statici generate.`);
