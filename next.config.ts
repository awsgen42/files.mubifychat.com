import type { NextConfig } from 'next';

/**
 * The UI is a fully static export served by the Worker's assets binding;
 * all dynamic behaviour lives in the Worker API under /api/*.
 */
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
