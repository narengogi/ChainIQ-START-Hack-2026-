import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mysql2", "neo4j-driver"],
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
