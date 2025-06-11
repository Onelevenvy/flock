/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  typescript: {
    // 如果设置了SKIP_TYPE_CHECK环境变量，则跳过类型检查
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },
  
  eslint: {
    // 如果设置了SKIP_TYPE_CHECK环境变量，则跳过ESLint检查
    ignoreDuringBuilds: process.env.SKIP_TYPE_CHECK === 'true',
  },

  turbopack: {
    rules: {
      "*.md": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },

  // For production mode
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      use: "raw-loader",
    });
    return config;
  },
}

export default nextConfig
