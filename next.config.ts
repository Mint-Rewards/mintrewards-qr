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
   * The standee template is read at runtime by file name chosen from config, which
   * static tracing cannot follow. Without this, the PDF is absent in production and
   * standee generation fails with "template not found" only after deploy.
   */
  outputFileTracingIncludes: {
    "/api/assignments/[id]/standee": ["./templates/**"],
    "/dev/standee-preview": ["./templates/**"],
  },
};

export default nextConfig;
