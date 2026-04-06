import { Helmet } from 'react-helmet-async';

// React 19 compatibility workaround
const HelmetComponent = Helmet as any;

interface DocSEOProps {
  title: string;
  description: string;
  category: string;
  path: string;
  lastUpdated?: string;
  author?: string;
}

export function DocSEO({ 
  title, 
  description, 
  category, 
  path,
  lastUpdated,
  author = 'RepoRadar'
}: DocSEOProps) {
  const fullTitle = `${title} | RepoRadar Docs`;
  const canonicalUrl = `https://reporadar.com/docs/${path}`;
  const imageUrl = 'https://reporadar.com/og-image.png'; // Default OG image

  // Structured data for documentation
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": title,
    "description": description,
    "datePublished": lastUpdated || new Date().toISOString(),
    "dateModified": lastUpdated || new Date().toISOString(),
    "author": {
      "@type": "Organization",
      "name": author
    },
    "publisher": {
      "@type": "Organization",
      "name": "RepoRadar",
      "logo": {
        "@type": "ImageObject",
        "url": "https://reporadar.com/logo.png"
      }
    },
    "articleSection": category
  };

  return (
    <HelmetComponent>
      {/* Basic meta tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="article" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content="RepoRadar" />
      
      {/* Twitter Card tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      
      {/* Article specific tags */}
      {lastUpdated && (
        <meta property="article:modified_time" content={lastUpdated} />
      )}
      <meta property="article:section" content={category} />
      
      {/* Structured data (JSON-LD) */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </HelmetComponent>
  );
}
