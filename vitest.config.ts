import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // React's automatic JSX runtime, so `.tsx` tests need no `import React`.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    // `.tsx` is included so component/render tests are picked up too — without
    // it they are silently skipped rather than reported as failing.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
