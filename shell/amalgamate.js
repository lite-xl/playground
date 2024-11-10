const { argv, cwd } = require("process");
const { readFileSync, writeFileSync } = require("fs");

const esbuild = require("esbuild");

const [outfile, assetLoader, wasmLoader, ...entryPoints] = argv.slice(2);

// wrap the asset loader as a ES6 module to properly import it in esbuild
const assetLoaderFile = `
module.exports = (() => {
  ${readFileSync(assetLoader, { encoding: "utf-8" })}
  return Module;
})();
`;
writeFileSync(`asset-loader.js`, assetLoaderFile, { encoding: "utf-8" });

esbuild.buildSync({
  entryPoints,
  outfile,
  bundle: true,
  minify: true,
  target: "es2017",
  logLevel: "info",
  sourcemap: true,
  alias: {
    "lite-xl": `./${wasmLoader}`,
    "asset-loader": "./asset-loader.js",
  },
});
