import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // This ensures static exports work correctly
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/webp'],
    minimumCacheTTL: 60,
    unoptimized: true
  }
};

export default nextConfig;
