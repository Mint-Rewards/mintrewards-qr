import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /**
   * There is a package-lock.json in the home directory above this project, which makes
   * Turbopack infer the workspace root as ~ and then fail to resolve the app directory.
   * Pinning the root to this project fixes route resolution.
   */
  turbopack: {
    root: path.resolve(__dirname),
  },

  /**
   * Templates are read at runtime by a file name chosen from config, which static
   * tracing cannot follow. Without this they are absent in production and generation
   * fails with "template not found" only after deploy.
   *
   * `/a/[code]` is here because the ambassador registration server action -- which
   * renders the card -- is bundled with the page that calls it.
   */
  outputFileTracingIncludes: {
    "/api/assignments/[id]/standee": ["./templates/**"],
    "/dev/standee-preview": ["./templates/**"],
    "/a/[code]": ["./templates/**"],
    "/dev/ambassador-card-preview": ["./templates/**"],
  },
};

export default nextConfig;
