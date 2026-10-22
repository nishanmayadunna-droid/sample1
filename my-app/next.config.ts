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
};

export default nextConfig;
