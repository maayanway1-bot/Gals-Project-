/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.playwright-mcp/**',
          '**/.claude/**',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
