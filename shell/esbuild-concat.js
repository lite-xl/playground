const { argv } = require("process");
const { readFileSync } = require("fs");
const esbuild = require("esbuild");

const [outputFile, bundleName, minify, ...files] = argv.slice(2);

const contents = files.map(f => readFileSync(f, { encoding: 'utf-8' }));
const finalContent = contents.join('\n');

esbuild.buildSync({
  stdin: { contents: finalContent, sourcefile: bundleName },
  minify: minify === "true",
  minifyIdentifiers: true,
  target: "es2017",
  logLevel: "info",
  outfile: outputFile,
});
