import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product photos are served from the project's public Storage buckets.
    remotePatterns: [
      new URL(
        "/storage/v1/object/public/**",
        process.env.NEXT_PUBLIC_SUPABASE_URL,
      ),
    ],
  },
  async headers() {
    return [
      {
        // The push service worker must never be served stale, or a fix would not reach browsers.
        source: "/firebase-messaging-sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
