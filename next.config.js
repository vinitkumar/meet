// Set STATIC_EXPORT=true to build a static site, e.g. for GitHub Pages.
const STATIC_EXPORT = process.env.STATIC_EXPORT === 'true';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  basePath: BASE_PATH,
  ...(STATIC_EXPORT && { output: 'export', trailingSlash: true }),
  productionBrowserSourceMaps: true,
  images: {
    formats: ['image/webp'],
    // Static hosts have no image optimization server.
    unoptimized: STATIC_EXPORT,
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // Important: return the modified config
    config.module.rules.push({
      test: /\.mjs$/,
      enforce: 'pre',
      use: ['source-map-loader'],
    });

    return config;
  },
  // Static hosts ignore custom headers, so only define them for the server build.
  headers: STATIC_EXPORT
    ? undefined
    : async () => {
        return [
          {
            source: '/(.*)',
            headers: [
              {
                key: 'Cross-Origin-Opener-Policy',
                value: 'same-origin',
              },
              {
                key: 'Cross-Origin-Embedder-Policy',
                value: 'credentialless',
              },
            ],
          },
        ];
      },
};

module.exports = nextConfig;
