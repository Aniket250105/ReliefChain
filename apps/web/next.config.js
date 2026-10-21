/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@reliefchain/shared-types'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.API_PROXY_URL || 'http://127.0.0.1:3002/api/:path*', // Proxy to Backend
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/dashboard/warehouseoperator',
        destination: '/dashboard/warehouse',
        permanent: false,
      },
      {
        source: '/dashboard/warehouse-operator',
        destination: '/dashboard/warehouse',
        permanent: false,
      },
      {
        source: '/dashboard/reliefofficer',
        destination: '/dashboard/officer',
        permanent: false,
      },
      {
        source: '/dashboard/relief-officer',
        destination: '/dashboard/officer',
        permanent: false,
      },
      {
        source: '/dashboard/ngoadmin',
        destination: '/dashboard/ngo',
        permanent: false,
      },
      {
        source: '/dashboard/ngo-admin',
        destination: '/dashboard/ngo',
        permanent: false,
      },
      {
        source: '/dashboard/governmentauthority',
        destination: '/dashboard/authority',
        permanent: false,
      },
      {
        source: '/dashboard/government-authority',
        destination: '/dashboard/authority',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
