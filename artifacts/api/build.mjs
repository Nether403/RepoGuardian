import { build } from "esbuild";

await build({
  bundle: true,
  entryPoints: ["src/index.ts"],
  external: ["cors", "express", "pg", "zod"],
  format: "esm",
  outfile: "dist/index.js",
  platform: "node",
  sourcemap: true,
  target: "node22"
});
