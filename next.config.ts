import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  productionBrowserSourceMaps: false, // 禁用生产环境 Source Maps 以减小体积
  serverExternalPackages: ['better-sqlite3'], // 强制不打包 Node.js 模块
  // 静态优化
  images: {
    unoptimized: true, // 禁用图片优化，减少 sharp 依赖的潜在打包体积
  },
  turbopack: {
    resolveAlias: {
      'better-sqlite3': './empty-module.js',
      'sharp': './empty-module.js',
    },
  },
};

export default nextConfig;
