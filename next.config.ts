import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ssh2"],
  allowedDevOrigins: ["ubuntu", "192.168.150.66"],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
