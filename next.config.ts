import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

// Production verification must not replace chunks used by a running dev server.
const config = (phase: string): NextConfig => ({
  devIndicators: false,
  // Keep development chunks separate from the production server build.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  // The questionnaire's /api/study route requires a Next.js server.
  images: { unoptimized: true },
});
export default config;
