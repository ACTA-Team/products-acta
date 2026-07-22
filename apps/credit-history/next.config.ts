import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ['@acta-products/ui', '@acta-products/acta', '@acta-products/types'],
};

export default withNextIntl(nextConfig);
