import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const API_ROOT = join(process.cwd(), "src", "app", "api");
const DIRECT_EXPORT_PATTERN =
  /export\s+(?:async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b|const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*async\b)/g;
const WRAPPED_EXPORT_PATTERN =
  /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*withActivityLogging\(/g;

function findRouteFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findRouteFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

const failures = [];

findRouteFiles(API_ROOT).forEach((filePath) => {
  const source = readFileSync(filePath, "utf8");
  const directExports = [...source.matchAll(DIRECT_EXPORT_PATTERN)].map(
    (match) => match[1] || match[2]
  );
  const wrappedExports = [...source.matchAll(WRAPPED_EXPORT_PATTERN)].map((match) => match[1]);

  if (directExports.length > 0 || wrappedExports.length === 0) {
    failures.push({
      file: relative(process.cwd(), filePath),
      directExports,
      wrappedExports,
    });
  }
});

if (failures.length > 0) {
  failures.forEach(({ file, directExports, wrappedExports }) => {
    process.stderr.write(
      `${file}: direct=[${directExports.join(",")}] wrapped=[${wrappedExports.join(",")}]\n`
    );
  });
  process.exit(1);
}

process.stdout.write("All API route handlers use the activity logging wrapper.\n");
