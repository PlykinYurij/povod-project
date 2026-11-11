import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Project instructions are maintained by the team, not the dev server.
  agentRules: false,
  // Keep ordinary next build/start intact; only the kit builder requests a traced runtime.
  output: process.env.POVOD_BUILD_KIT === "1" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
