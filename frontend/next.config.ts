import type { NextConfig } from "next";

// Where the Express backend runs, as seen from this Next.js server. Backend paths are
// proxied through the frontend's own origin so the app can be served from ONE public
// URL (e.g. an ngrok tunnel): the browser never needs to reach the backend directly.
const backend = process.env.BACKEND_ORIGIN ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // The dashboard is client-rendered (auth via API cookie), so Cache Components /
  // partial prefetching are left off; they only add dev-time instant-navigation warnings here.
  // Hide the floating "N" dev indicator (compile/runtime errors are still shown).
  devIndicators: false,
  async rewrites() {
    return ["/api/:path*", "/auth/:path*", "/slack/:path*", "/admin/queues", "/admin/queues/:path*"].map((source) => ({
      source,
      destination: `${backend}${source}`,
    }));
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
