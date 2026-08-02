import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /*
   * The prediction route reads the trained model off disk at runtime. Next's
   * file tracing cannot infer that from an `fs.readFile`, so the artifacts are
   * declared explicitly — without this they are missing from a standalone
   * deployment and the neural strategy fails there while working locally.
   */
  outputFileTracingIncludes: {
    '/api/predictions/generate': ['./public/model/**'],
  },
};

export default nextConfig;
