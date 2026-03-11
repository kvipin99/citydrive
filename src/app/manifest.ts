import type { MetadataRoute } from 'next';

/**
 * Returns a valid minimal manifest to prevent build-time crashes.
 * Next.js 15 requires a valid manifest object if this file exists.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Citydrive Systems',
    short_name: 'Citydrive',
    description: 'Driving School Management Portal',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    icons: [],
  };
}
