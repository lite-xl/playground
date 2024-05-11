/**
 * @file Sets up the environment for running Lite XL.
 * @author takase1121
 */

import { ENV, FS, reloadEmscriptenEnv } from "./env.mjs";
import { mkdirp, uploadFiles, downloadFiles } from "./fs.mjs";
import { IDBSync } from "./idbsync.mjs";

// export the Module object explicitly to prevent minifiers from touching it
window.Module = {
  preRun: [],
  arguments: [],
};

let storageReady, runtimeReady, started;
/**
 * Starts Lite XL.
 */
function start() {
  if (runtimeReady && storageReady && !started) {
    started = true;
    console.log("Starting Lite XL...");
    document.getElementById("loading").style.display = "none";
    FS.chdir("/home/web_user");

    // set up autosave
    Module.idbSync.start();
    Module.callMain(Module.arguments);
  }
}

// export functions accessed by C
Module.idbSync = new IDBSync();
Module.uploadFiles = uploadFiles;
Module.downloadFiles = downloadFiles;

Module.thisProgram = "/usr/bin/lite-xl";
Module.noInitialRun = true;
Module.preRun.push(() => {
  reloadEmscriptenEnv();
  ENV.LITE_SCALE = window.devicePixelRatio.toString();
  ENV.LITE_XL_RUNTIME = "core.wasm_core";

  // mount IDBFS in home folder
  mkdirp("/home/web_user");
  FS.mount(Module.IDBFS, {}, "/home/web_user");
  FS.syncfs(true, (e) => {
    if (e) {
      console.error("syncfs(true) failed: ", e);
    } else {
      storageReady = true;
      start();
    }
  });
});
Module.onExit = () => {
  document.getElementById("loading").style.display = "none";
  document.getElementById("canvas").style.display = "none";
  document.getElementById("close").style.display = "block";
  Module.idbSync.stop();
};
Module.onRuntimeInitialized = () => {
  runtimeReady = true;
  start();
};

/**
 * Writes a string as a series of keyboard events.
 * @param {InputEvent|CompositionEvent} e
 */
function addInput(e) {
  if (e.data) {
    // emulate keypress events
    for (const char of [...e.data]) {
      window.dispatchEvent(
        new KeyboardEvent("keypress", {
          key: char,
          isComposing: e.isComposing,
          charCode: char.charCodeAt(char.length - 1),
        })
      );
    }
  }
}

// attach canvas to module
window.addEventListener("load", () => {
  const status = document.getElementById("status");
  Module.canvas = document.getElementById("canvas");
  Module.canvas.oncontextmenu = (e) => e.preventDefault();
  Module.setStatus = (s) => {
    status.textContent = s === "" ? "Initializing..." : s;
  };

  // hook up our text input
  const textInput = document.getElementById("textinput");

  // ignore composition text, only get end result
  textInput.addEventListener("compositionend", addInput);
  textInput.addEventListener("input", (e) => {
    if (e.inputType == "deleteContentBackward") {
      const ev = {
        isComposing: e.isComposing,
        code: "Backspace",
      };
      // keypress does not send backspace events
      window.dispatchEvent(new KeyboardEvent("keydown", ev));
      window.dispatchEvent(new KeyboardEvent("keyup", ev));
    } else if (!e.isComposing) addInput(e);
  });
});

// require the bundle loader and lite-xl itself, the actual paths are
// handled by esbuild script itself.
require("lite-xl");
require("lite-xl-bundle");
