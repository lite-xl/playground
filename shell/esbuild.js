const installAndRun = require("./deps");

installAndRun((outputFile, minify, entrypoint, ...inject) => {
  const esbuild = require("esbuild");
  const { minify_sync } = require("terser");
  const { writeFileSync } = require("fs");
  const output = esbuild.buildSync({
    entryPoints: [entrypoint],
    bundle: true,
    minify: entrypoint.endsWith("js") ? false : minify == "true",
    target: "es2017",
    logLevel: "info",
    outfile: outputFile,
    write: !entrypoint.endsWith("js"),
    inject,
  });
  if (entrypoint.endsWith("js") && minify == "true") {
    const minified = minify_sync(output.outputFiles[0].text, {
      compress: {
        booleans_as_integers: true,
        ecma: 2017,
        passes: 3,
      },
    });
    writeFileSync(outputFile, minified.code, { encoding: "utf8" });
  }
});
