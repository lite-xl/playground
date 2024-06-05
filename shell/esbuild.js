const installAndRun = require("./deps");

installAndRun((outputFile, minify, ...entrypoints) => {
  const esbuild = require("esbuild");
  esbuild.buildSync({
    entryPoints: entrypoints,
    bundle: true,
    minify: minify === "true",
    target: "es2017",
    logLevel: "info",
    outfile: outputFile,
  });
});
