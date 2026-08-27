import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The native app at the repo root has its own lockfile; without this Next
  // infers the wrong workspace root and walks the whole repo.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
