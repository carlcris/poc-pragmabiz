import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default defineConfig({
  ...baseConfig,
  test: { ...baseConfig.test, include: ["scripts/benchmark-login.test.ts"], testTimeout: 120_000 },
});
