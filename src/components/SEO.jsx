import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SEO = ({ title, description, image }) => {
  const location = useLocation();
  const baseUrl = "https://sebamox.dev";
  const canonicalUrl = `${baseUrl}${location.pathname}`;

  return (
    <Helmet>
      <title>{title ? `${title} | Seba Mollo` : "Seba Mollo | Creative Dev"}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      {image && <meta property="og:image" content={`${baseUrl}${image}`} />}
    </Helmet>
  );
};

export default SEO;