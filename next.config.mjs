/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
    // ship the per-customer med-map HTML files into the serverless function bundle
    outputFileTracingIncludes: {
      "/api/customers/[id]/med-map": ["./lib/reports/med-map/**/*"],
    },
  },
};

export default nextConfig;
