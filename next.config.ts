import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

// Production verification must not replace chunks used by a running dev server.
const config = (phase: string): NextConfig => ({
  devIndicators: false,
  // Static export treats a custom production distDir as the export directory,
  // so isolate development instead and keep production's standard .next/out.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  output: 'export',
  images: { unoptimized: true },
});
export default config;
