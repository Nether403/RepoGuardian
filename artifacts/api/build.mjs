import { build } from "esbuild";

await build({
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"
  },
  bundle: true,
  entryPoints: ["src/index.ts"],
  external: ["cors", "express", "pg", "zod"],
  format: "esm",
  outfile: "dist/index.js",
  platform: "node",
  sourcemap: true,
  target: "node22"
});
