import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/admin',
    name: 'VERITAS Admin',
    short_name: 'VERITAS',
    description: 'VERITAS Business Control Center',
    start_url: '/admin/dashboard',
    scope: '/admin/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#070707',
    theme_color: '#0A0A0A',
    categories: ['business', 'productivity', 'finance'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
