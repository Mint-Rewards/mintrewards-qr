import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup-env.ts"],
    include: ["tests/**/*.test.ts"],
    // Rasterising and decoding a 12"x30" PDF is not fast.
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      // `server-only` exists to fail the build if a server module is imported into the
      // client bundle. Under Node there is no such distinction, so stub it out.
      "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
});
