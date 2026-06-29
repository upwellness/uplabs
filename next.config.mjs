/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
    // ship the per-customer report HTML files into the serverless function bundle
    outputFileTracingIncludes: {
      "/api/customers/[id]/med-map": ["./lib/reports/med-map/**/*"],
      "/api/customers/[id]/lab-report": ["./lib/reports/lab-report/**/*"],
      "/r/lab/[token]": ["./lib/reports/lab-report/**/*"],
    },
  },
};

export default nextConfig;
