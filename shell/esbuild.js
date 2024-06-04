const { argv } = require("process");
const esbuild = require("esbuild");

const [outputFile, minify, ...entrypoints] = argv.slice(2);

esbuild.buildSync({
  entryPoints: entrypoints,
  bundle: true,
  minify: minify === "true",
  target: "es2017",
  logLevel: "info",
  outfile: outputFile,
});
