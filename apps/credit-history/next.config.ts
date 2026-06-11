import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ['@acta-products/ui', '@acta-products/acta', '@acta-products/types'],
};

export default nextConfig;
