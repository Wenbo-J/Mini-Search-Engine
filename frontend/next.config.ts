/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*', // Matches /api/search, /api/health, etc.
        destination: 'http://localhost:8000/:path*', // Proxies to Python backend
      },
    ];
  },
};

module.exports = nextConfig;