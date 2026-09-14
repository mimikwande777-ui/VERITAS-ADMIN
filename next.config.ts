import type {NextConfig} from 'next';

// Safe build-time public environment resolution (Never uses service-role or secret keys)
const resolvedPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const resolvedPublicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Build-time validation printout (Never prints actual values)
console.log(`PUBLIC_SUPABASE_URL_RESOLVED: ${resolvedPublicSupabaseUrl ? 'YES' : 'NO'}`);
console.log(`PUBLIC_SUPABASE_ANON_KEY_RESOLVED: ${resolvedPublicSupabaseAnonKey ? 'YES' : 'NO'}`);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdzvmnixlhjjrpyoaemg.supabase.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },

  env: {
    NEXT_PUBLIC_SUPABASE_URL: resolvedPublicSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolvedPublicSupabaseAnonKey,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  },

  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify - file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
