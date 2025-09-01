import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', '172.17.105.131'], // Add camera IP addresses here
  },
  /* config options here */
};

export default nextConfig;
