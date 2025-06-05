/** @type {import('next').NextConfig} */
const { withAxiom } = require('next-axiom')

const nextConfig = {
  images: {
    loader: 'custom',
    loaderFile: './lib/cloudflare-loader.ts',
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    unoptimized: false, // keep <Image>'s src-set logic
    deviceSizes: [516], // Only the exact size we need for cards
    imageSizes: [16, 36, 40, 48, 56, 64, 82, 96], // All the specific sizes used in the app
  },
  // Add rewrites for profile pages
  async rewrites() {
    return [
      {
        // User-facing route
        source: '/@:username([^/]+)',
        destination: '/profile/:username',
      }
    ];
  },
  webpack: (config, { isServer, nextRuntime }) => {
    // Only add fallbacks for client-side bundles or edge runtime
    if (!isServer || nextRuntime === 'edge') {
      // For Edge Runtime polyfills, inject our custom polyfill file 
      // at the beginning of the entry points
      const originalEntry = config.entry;
      config.entry = async () => {
        const entries = await originalEntry();
        
        // Add polyfills to each entry point that might run in Edge Runtime
        Object.keys(entries).forEach((entry) => {
          // Check if the entry is an array before using includes
          if (
            entry !== 'webpack-runtime' && 
            entry !== 'polyfills' && 
            Array.isArray(entries[entry])
          ) {
            // Check if polyfill is already included
            const hasPolyfill = entries[entry].some(
              (path) => typeof path === 'string' && path.includes('./lib/edge-polyfills')
            );
            
            if (!hasPolyfill) {
              entries[entry] = ['./lib/edge-polyfills.js', ...entries[entry]];
            }
          }
        });
        
        return entries;
      };
      
      // Standard fallbacks for Node.js APIs
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
  experimental: {
    serverActions: true,
  },
};

module.exports = withAxiom(nextConfig); 