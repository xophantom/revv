import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Postgres driver + Prisma out of the bundler so native deps
  // load through Node's require, not Turbopack.
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/client"],
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
