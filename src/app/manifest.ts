import type { MetadataRoute } from 'next';

/**
 * PWA features disabled per request.
 * Returning an empty object to satisfy routing while preventing manifest generation.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {};
}
