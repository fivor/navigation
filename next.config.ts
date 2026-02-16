import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  productionBrowserSourceMaps: false, // 禁用生产环境 Source Maps 以减小体积
  // serverExternalPackages: ['better-sqlite3'], // 已禁用本地 SQLite，不再需要排除
  // 静态优化
  images: {
    unoptimized: true, // 禁用图片优化，减少 sharp 依赖的潜在打包体积
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', '@headlessui/react', 'framer-motion'],
  },
  turbopack: {
    resolveAlias: {
      'better-sqlite3': './empty-module.js',
      'sharp': './empty-module.js',
      'cheerio': './empty-module.js',
    },
  },
  webpack: (config) => {
    // 强制忽略 Node.js 专有模块，防止被打包进 Edge Worker
    config.resolve.alias = {
      ...config.resolve.alias,
      'better-sqlite3': false,
      'sharp': false,
      'cheerio': false,
    };
    return config;
  },
};

export default nextConfig;
