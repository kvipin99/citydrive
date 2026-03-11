import type { MetadataRoute } from 'next';

/**
 * Minimal manifest to satisfy Next.js build requirements while removing PWA features.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Citydrive',
    short_name: 'Citydrive',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    icons: [],
  };
}
