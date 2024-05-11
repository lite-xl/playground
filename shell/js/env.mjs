/**
 * @file Exports Module.FS and Module.ENV.
 * @author takase1121
 */

export let FS = {},
  ENV = {};

/**
 * Loads the FS and ENV object from Module.
 */
export function reloadEmscriptenEnv() {
  FS = Module.FS;
  ENV = Module.ENV;
}
