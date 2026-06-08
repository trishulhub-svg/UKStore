import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel handles output automatically — do NOT use output: "standalone" on Vercel */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
