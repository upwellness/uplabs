/** @type {import('next').NextConfig} */

// ── v2 is now the primary site ────────────────────────────────────────────
// Root + each v1 app LANDING page redirect to their /v2 twin. Deep detail pages
// (/customers/[id], /pulse/report/[id], …) are intentionally NOT redirected:
// they remain on v1 as the backup AND as the `?legacy=1` fallback that several
// v2 pages still link to. Apps without a v2 twin (cgm, cards, content) are left
// untouched. `permanent: false` (307) keeps this easily reversible.
const V2_LANDING_REDIRECTS = [
  ["/", "/v2"],
  ["/customers", "/v2/customers"],
  ["/bca", "/v2/bca"],
  ["/pulse", "/v2/pulse"],
  ["/checkform", "/v2/checkform"],
  ["/prospects", "/v2/prospects"],
  ["/healthcheck", "/v2/healthcheck"],
  ["/nutriscan", "/v2/nutriscan"],
  ["/nutriscan/log", "/v2/nutriscan/log"],
  ["/plate-planner", "/v2/plate-planner"],
  ["/designer", "/v2/designer"],
  ["/line-bot", "/v2/line-bot"],
  ["/admin/users", "/v2/admin/users"],
  ["/admin/backup", "/v2/admin/backup"],
];

const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return V2_LANDING_REDIRECTS.map(([source, destination]) => ({
      source,
      destination,
      permanent: false,
    }));
  },
  experimental: {
    typedRoutes: false,
    // ship the per-customer report HTML files into the serverless function bundle
    outputFileTracingIncludes: {
      // med-map still served from filesystem (TODO: migrate to Supabase like lab-report)
      "/api/customers/[id]/med-map": ["./lib/reports/med-map/**/*"],
      // lab-report + public share now read from Supabase (customer_report_html) — no file bundling
    },
  },
};

export default nextConfig;
