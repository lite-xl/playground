/**
 * @file Runs esbuild.
 * @author takase1121
 */

import * as esbuild from "esbuild";
import { env } from "process";

await esbuild.build({
  entryPoints: ["js/main.mjs", "js/advanced.mjs", "css/main.css"],
  bundle: true,
  sourcemap: true,
  minify: true,
  target: "es2017",
  alias: {
    "lite-xl-bundle": env.BUNDLE_PATH,
    "lite-xl": env.LITE_XL_PATH,
  },
  external: ["child_process", "path", "fs"],
  logLevel: "info",
  outdir: "dist",
});
