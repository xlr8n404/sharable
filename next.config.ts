import type { NextConfig } from "next";

let loaderPath: string | undefined;
try {
  loaderPath = require.resolve('orchids-visual-edits/loader.js');
} catch {
  // loader not available in production build
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
    async redirects() {
      return [
        {
          source: '/login',
          destination: '/',
          permanent: true,
        },
        {
          source: '/register',
          destination: '/',
          permanent: true,
        },
        {
          source: '/notifications',
          destination: '/alerts',
          permanent: true,
        },
      ];
    },
  ...(loaderPath
    ? {
        turbopack: {
          rules: {
            "*.{jsx,tsx}": {
              loaders: [loaderPath],
            },
          },
        },
      }
    : {}),
};

export default nextConfig;
// Orchids restart: 1770870689662