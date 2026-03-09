'use client';

import { useEffect } from 'react';

/**
 * PWAManager handles the registration of the Service Worker
 * to make the application installable as a PWA.
 */
export function PWAManager() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      window.location.protocol === 'https:' || window.location.hostname === 'localhost'
    ) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Citydrive PWA: ServiceWorker registered successfully', registration.scope);
          })
          .catch((error) => {
            console.error('Citydrive PWA: ServiceWorker registration failed', error);
          });
      });
    }
  }, []);

  return null;
}
