import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.PAGES_BASE_PATH ?? "/DailyBoke",
  trailingSlash: true,
  poweredByHeader: false,
  turbopack: { root: path.resolve(process.cwd(), "..") },
};

export default nextConfig;
