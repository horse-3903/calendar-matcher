import esbuild from "esbuild";

esbuild.build({
  entryPoints: ["app/static/main.js"],
  bundle: true,
  minify: false,
  sourcemap: false,
  outfile: "app/static/main.bundle.js",
  format: "iife",
  target: ["es2018"]
}).then(() => {
  console.log("Wrote app/static/main.bundle.js");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
