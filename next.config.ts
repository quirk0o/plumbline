import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.contentapi.ea.com' },
    ],
  },
};

export default nextConfig;
