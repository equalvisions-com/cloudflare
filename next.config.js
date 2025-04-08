/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30, // Cache images for 30 days
  },
  webpack: (config, { isServer }) => {
    // Add polyfills for all environments (client and edge)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      fs: false,
      dns: false,
      child_process: false,
      timers: require.resolve('timers-browserify'),
      process: false // Explicitly mark process as false to prevent it from being included
    };

    // For Edge Runtime compatibility
    if (!isServer || (isServer && process.env.NEXT_RUNTIME === 'edge')) {
      // These polyfills are needed for Edge Runtime
      config.resolve.alias = {
        ...config.resolve.alias,
        process: 'process/browser' // Use browser version of process
      };
    }
    
    return config;
  },
  experimental: {
    // Enable this to make debugging easier if needed
    // outputFileTracingExcludes: {
    //   '*': ['fast-xml-parser', 'timers-browserify'],
    // },
  }
};

module.exports = nextConfig; 