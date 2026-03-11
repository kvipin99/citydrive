import type { MetadataRoute } from 'next';

/**
 * Valid manifest object required for Next.js build stability.
 * Provides basic application metadata while resolving 404 errors.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Citydrive',
    short_name: 'Citydrive',
    description: 'Driving School Management System',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1991a7',
    icons: [
      {
        src: 'https://picsum.photos/seed/citydrive-icon/192/192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://picsum.photos/seed/citydrive-icon/512/512',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
