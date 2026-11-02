import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Postgres driver + Prisma out of the bundler so native deps
  // load through Node's require, not Turbopack.
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/client"],
  // The OAuth consent page grants access with one click, so it must never render inside a frame.
  async headers() {
    return [{
      source: "/oauth/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
  turbopack: {
    // Turbopack dev can't resolve the `util/types` builtin subpath that `pg`
    // requires. Map it to a shim that re-exports the real `util.types`.
    resolveAlias: {
      "util/types": "./turbopack-shims/util-types.js",
      "node:util/types": "./turbopack-shims/util-types.js",
    },
  },
};

export default nextConfig;
