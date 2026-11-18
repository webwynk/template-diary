import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    // Template content is sent gzip-compressed and capped at 4 MB compressed
    // (lib/templates/upload.ts); this leaves room for the other form fields.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  // Headless Chromium for /api/screenshot is read from disk at runtime; make sure Vercel ships it.
  outputFileTracingIncludes: {
    "/api/screenshot": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  async redirects() {
    return [{ source: "/settings", destination: "/settings/tags", permanent: false }];
  },
  partialPrefetching: true,
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
