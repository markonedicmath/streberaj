import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  poweredByHeader: false,
  webpack(config) {
    if (process.env.NEXT_CLOUDFLARE_BUILD === "1") config.resolve.alias["./local-db"] = path.resolve("src/lib/local-db-unavailable.ts");
    return config;
  },
  outputFileTracingExcludes: {
    "/*": ["./.data/**/*", "./.env*", "./.dev.vars*", "./.wrangler/**/*", "./.next-qa/**/*", "./tests/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
