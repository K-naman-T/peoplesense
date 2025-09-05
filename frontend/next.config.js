/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', '172.17.105.131'],
  },
  // Add this configuration to allow dev origins
  allowedDevOrigins: [
    '172.17.106.81',  // Add the origin from the warning
    'localhost',
  ],
};

module.exports = nextConfig;