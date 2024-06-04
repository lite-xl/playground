const { execSync } = require("child_process");
const { argv, cwd, chdir } = require("process");

/**
 * Installs dependencies and run the callback.
 * @param {function} callback
 */
function installAndRun(callback) {
  try {
    require("esbuild");
    require("google-closure-compiler");
  } catch (e) {
    const pwd = cwd();
    chdir(__dirname);
    execSync("npm ci", { stdio: "inherit" });
    chdir(pwd);
  } finally {
    callback(...argv.slice(2));
  }
}

module.exports = installAndRun;
