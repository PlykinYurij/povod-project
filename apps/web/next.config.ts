import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Project instructions are maintained by the team, not the dev server.
  agentRules: false,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
