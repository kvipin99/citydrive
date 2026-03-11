import type { MetadataRoute } from 'next';

/**
 * PWA features disabled per request.
 * Returning null explicitly tells Next.js to not generate a manifest link,
 * resolving 404 errors and build-time rollout failures.
 */
export default function manifest(): MetadataRoute.Manifest | null {
  return null;
}
