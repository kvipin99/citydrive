
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Citydrive Management System',
    short_name: 'Citydrive',
    description: 'Comprehensive management system for driving schools.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2baec4',
    orientation: 'portrait',
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
