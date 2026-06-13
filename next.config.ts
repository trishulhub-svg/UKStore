import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  turbopack: {
    resolveAlias: {
      // Allow CSS url('/logo.svg') to resolve to the public directory
      "/logo.svg": path.resolve(__dirname, "public/logo.svg"),
    },
  },
};

export default nextConfig;
