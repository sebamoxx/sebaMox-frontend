import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { SITE, resolveSeo, toAbsolute } from '../seo.config';

// Tag SEO/social iniettati lato client. La fonte dei dati è src/seo.config.js
// (la stessa usata dal prerender statico → zero rischio di disallineamento).
// Le props sono opzionali: se passate, hanno priorità sul config per quella
// pagina. Normalmente basta usare <SEO /> e lasciar fare al config in base
// al path corrente.
const SEO = ({ title, description, image } = {}) => {
  const { pathname } = useLocation();
  const seo = resolveSeo(pathname);

  const finalTitle = title ? `${title} | ${SITE.titleSuffix}` : seo.title;
  const finalDescription = description || seo.description;
  const finalImage = image ? toAbsolute(image) : seo.image;
  const { url } = seo;

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <link rel="canonical" href={url} />

      {/* ── Open Graph (Facebook, WhatsApp, LinkedIn, Telegram…) ── */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:locale" content={SITE.locale} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={finalImage} />

      {/* ── Twitter / X ── */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={finalImage} />
    </Helmet>
  );
};

export default SEO;
