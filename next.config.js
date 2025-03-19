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
    // Only add fallbacks for client-side bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        child_process: false,
        timers: require.resolve('timers-browserify'),
      };
    }
    
    return config;
  },
};

module.exports = nextConfig; 