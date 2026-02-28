import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ['better-sqlite3'],
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', '@headlessui/react', 'framer-motion'],
  },
  async rewrites() {
    return [
      {
        source: '/icons/:path*',
        destination: '/api/icons/:path*',
      },
    ];
  },
};

export default nextConfig;
