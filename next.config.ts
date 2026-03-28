import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storefront-prod.nl.picnicinternational.com",
      },
    ],
  },
};

export default nextConfig;
