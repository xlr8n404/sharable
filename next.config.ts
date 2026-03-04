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
  // Experimental turbo loader disabled to resolve 500 error
  /*
  ...(loaderPath
    ? {
        experimental: {
          turbo: {
            rules: {
              "*.{jsx,tsx}": {
                loaders: [loaderPath],
              },
            },
          },
        },
      }
    : {}),
  */
};

export default nextConfig;
// Orchids restart: 1770870689662