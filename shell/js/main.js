var Module = {
    preRun: []
  };
  (() => {
    "use strict";
  
    const homeFolder = "/home/web_user";
    let storageReady, runtimeReady, started;
    const mkdir = (dir) => {
      try {
        FS.mkdir(dir);
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
    };
    const start = () => {
      if (runtimeReady && storageReady && !started) {
        started = true;
        console.log("Starting Lite XL...");
        document.getElementById("loading").style.display = "none";
        FS.chdir(homeFolder);
  
        // set up autosave
        let timeout;
        let count = 5;
        const statusText = document.getElementById("status_text");
        let handler = () => {
          statusText.textContent = `Syncing in ${count} second(s)`;
          if (--count < 0) {
            // need to save
            statusText.textContent = "Saving...";
            FS.syncfs((e) => {
              count = 5;
              if (e) {
                statusText.textContent = `Cannot sync. Trying again in ${count} second(s)`;
                console.error(e.code ? e.code : e);
              } else {
                statusText.textContent = "Saved.";
              }
              timeout = setTimeout(handler, 1000);
            });
          } else {
            timeout = setTimeout(handler, 1000);
          }
        };
        timeout = setTimeout(handler, 1000);
        callMain(Module.arguments);
      }
    };
    Module.arguments = [`${homeFolder}/welcome.md`];
    Module.thisProgram = "/usr/bin/lite-xl";
    Module.noInitialRun = true;
    Module.preRun.push(() => {
      ENV.LITE_SCALE = window.devicePixelRatio.toString();
  
      // mount and use IDBFS
      mkdir("/var");
      FS.mount(IDBFS, {}, "/var");
      FS.syncfs(true, (e) => {
        if (e) {
          console.error(e.code ? e.code : e);
        } else {
          // initialize everything
          mkdir("/var/data");
          mkdir("/var/config");
          mkdir(`${homeFolder}/.config`);
          FS.symlink("/var/config", `${homeFolder}/.config/lite-xl`);
          FS.symlink("/var/data", `${homeFolder}/persistent`);
          storageReady = true;
          start();
        }
      });
      FS.writeFile(
        `${homeFolder}/welcome.md`,
        "# Welcome to Lite XL!\n\n" +
          "This is an instance of Lite XL running on your browser using **JavaScript** and **WASM**.\n\n" +
          "There isn't a lot of things you can do here; you can **create, edit and save files**,\n" +
          "but they _will not be persisted_ across different tabs / sessions.\n\n" +
          "Not all plugins work, and **some keyboard shortcuts might not work** if your browser\n" +
          "overrides them. Nevertheless, this is pretty cool.\n\n" +
          "# Autosave\n\n" +
          "If everything goes perfectly, your user config and any files in `persistent` directory\n" +
          "will be saved across different sessions.\n" +
          "The program automatically syncs any changes into your Browser's storage every 5 seconds.\n" +
          "We're working on improving this system (e.g. explicitly sync when you save a file in the editor),\n" +
          "so expect bugs and never save important data with this.\n" +
          "If you see `Autosave: Saving...` on the top right corner, **DO NOT CLOSE THE TAB.**\n"
      );
    });
    Module.onExit = () => {
      document.getElementById("loading").style.display = "none";
      document.getElementById("canvas").style.display = "none";
      document.getElementById("close").style.display = "block";
    };
    Module.onRuntimeInitialized = () => {
      runtimeReady = true;
      start();
    };
  
    // attach canvas to module
    window.onload = () => {
      const status = document.getElementById("status");
      Module.canvas = document.getElementById("canvas");
      Module.canvas.oncontextmenu = (e) => e.preventDefault();
      Module.setStatus = (s) => {
        status.textContent = s === "" ? "Initializing..." : s;
      };
    };
  })();
  