/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Disable ESLint during production builds
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint during build
  },

  // Disable TypeScript errors during builds (for now)
  typescript: {
    ignoreBuildErrors: true, // Skip TypeScript errors during build
  },

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
  // output: 'standalone', // Temporarily commented out to fix build issues

  // SWC minification is enabled by default in Next.js 15

  // Compiler options for Next.js 15
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
}

module.exports = nextConfig
