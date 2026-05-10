import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.contentapi.ea.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
