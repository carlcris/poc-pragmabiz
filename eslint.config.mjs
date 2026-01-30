import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    ignores: ["**/.next/**", "**/node_modules/**", "next-env.d.ts", "eslint.config.mjs"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: [
      "**/*.config.js",
      "**/*.config.cjs",
      "**/*.config.mjs",
      "**/next-i18next.config.js",
      "**/tailwind.config.ts",
      "**/postcss.config.mjs",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default config;
