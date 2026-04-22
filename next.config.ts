import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['qiniu'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'http',
        hostname: '*.clouddn.com',
      },
    ],
  },
};

export default nextConfig;
