import { build } from "esbuild";

await build({
  entryPoints: ["app/static/main.js"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  outfile: "app/static/main.bundle.js",
  sourcemap: true,
});

console.log("Wrote app/static/main.bundle.js");
