const { argv } = require("process");
const esbuild = require("esbuild");

const [outputFile, bundle, minify, ...entrypoints] = argv.slice(2);

esbuild.buildSync({
  entryPoints: entrypoints,
  bundle: bundle === "true",
  minify: minify === "true",
  target: "es2017",
  logLevel: "info",
  outfile: outputFile,
  reserveProps: /Module/
});
