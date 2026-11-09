import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Aadhaar scans (front + back) are uploaded through Server Actions.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
