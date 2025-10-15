/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Environment variables configuration
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081',
  },

  // Image optimization configuration
  images: {
    domains: ['localhost'],
    unoptimized: true, // For development
  },

  // Webpack configuration for canvas libraries
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    return config;
  },

  // Output configuration for deployment
  output: 'standalone',

  // SWC minification is enabled by default in Next.js 15

  // Compiler options for Next.js 15
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
}

module.exports = nextConfig
