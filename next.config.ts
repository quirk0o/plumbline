import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.contentapi.ea.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    // In dev, /media/<key> 302-redirects to the local MinIO presigned URL
    // (http://localhost:9000/...). Next 16's image optimizer blocks fetching
    // from local IPs by default (SSRF guard); allow it in development only.
    // Production uses Cloudflare R2 on a public host, so this stays off there.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
  },
};

export default nextConfig;
