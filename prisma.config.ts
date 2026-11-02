import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// quiet: dotenv's banner goes to stdout and ends up inside `prisma migrate diff --script > file`.
config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
