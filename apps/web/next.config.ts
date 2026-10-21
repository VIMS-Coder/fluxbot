import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: ['@fluxbot/core', '@fluxbot/db', '@fluxbot/fluxer', '@fluxbot/modules'],
  serverExternalPackages: ['postgres'],
  poweredByHeader: false,
};

export default nextConfig;
