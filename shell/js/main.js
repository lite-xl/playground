var Module = {
  preRun: [],
  arguments: [],
};
(() => {
  "use strict";

  /**
   * Splits the path into different segments.
   * @param {string} path The path.
   */
  function pathSegments(path) {
    // if the first path segment is empty, it's probably the root
    // if other path segments are empty, it's just //bla and you can assume it's . in the middle
    const segments = path
      .split("/")
      .map((x, i) => (x === "" ? (i === 0 ? "" : ".") : x));
    if (segments[segments.length - 1] === ".") segments.pop();

    return segments.map(
      (x, i, a) => a.slice(0, i + 1).join("/") + (x === "" ? "/" : ""),
    );
  }

  /**
   * Creates a directory.
   * @param {string} dir The directory.
   */
  function mkdirp(dir) {
    for (const segment of pathSegments(dir)) {
      try {
        FS.mkdir(segment);
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
    }
  }

  /**
   * Manages syncings from IDBFS to IndexedDB.
   */
  class IDBSync {
    constructor(interval = 5000) {
      this.autoSync = true;
      this.saveInterval = interval;
      this.queue = [];
      this.seq = 0;
      this.running = false;
      this.syncStatus = {
        files: { status: "Ready", time: new Date() },
        workspace: { status: "Ready", time: new Date() },
      };
    }

    /**
     * Sets the interval where auto sync is carried out.
     * @param {number} interval The save interval.
     */
    setInterval(interval) {
      this.saveInterval = interval;
      this.start();
    }

    /**
     * Gets the interval where auto sync is carried out.
     * @returns {number}
     */
    getInterval() {
      return this.saveInterval;
    }

    /**
     * Enables or disables auto sync.
     */
    setAutoSync(enabled) {
      this.autoSync = enabled;
      this.start();
    }

    /**
     * Checks if auto sync is enabled.
     * @returns {boolean}
     */
    getAutoSync() {
      return this.autoSync;
    }

    /**
     * Starts the autosync timer.
     */
    start() {
      console.log(
        `IDBSync autosync: ${this.autoSync}, interval: ${this.saveInterval}`,
      );
      this.stop();
      if (!this.autoSync) return;
      this.saveTimeout = setTimeout(() => this.save(), this.saveInterval);
    }

    /**
     * Sync file changes to IndexedDB.
     */
    async save() {
      // store the resolve and reject functions, we will need it later
      const id = this.seq++;
      console.log("Save ID: ", id);
      const promise = new Promise((res, rej) =>
        this.queue.push([id, res, rej]),
      );
      if (!this.running) this.execQueue();
      return promise;
    }

    /**
     * Sync file changes to IndexedDB in a set timeout, ignoring all requests in between.
     * This is implemented here because doing it in Lua will be unreliable with asyncify.
     */
    async saveDebounced(debouncePeriod) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = undefined;
      }
      return new Promise((res, rej) => {
        this.debounceTimer = setTimeout(
          () => this.save().then(res).catch(rej),
          debouncePeriod,
        );
      });
    }

    /**
     * Finishes all sync operations on the queue.
     */
    async execQueue() {
      if (this.queue.length === 0) {
        // wait for more items (by using sleep)
        this.running = false;
        return this.start();
      }
      const [id, res, rej] = this.queue.shift();
      this.setFileSyncStatus("Syncing...");
      // add an animation
      document.getElementById("sync_icon").classList.add("sync_anim");
      try {
        this.running = true;
        await new Promise((res, rej) =>
          FS.syncfs((e) => (e ? rej(e) : res(e))),
        );
        this.setFileSyncStatus("Synced.");
        console.log("Save completed, ID: ", id);
        res();
      } catch (e) {
        this.setFileSyncStatus("Cannot sync. Please check your console.");
        console.error("syncfs() failed:", e);
        rej(e);
      } finally {
        document.getElementById("sync_icon").classList.remove("sync_anim");
      }
      // technically we have TCO, but it really dont exist.
      return this.execQueue();
    }

    /**
     * Sets file sync status.
     * @param {string} msg The message.
     */
    setFileSyncStatus(msg) {
      this.syncStatus.files.status = msg;
      this.syncStatus.files.time = new Date();
      this.updateStatus();
    }

    /**
     * Sets the workspace sync status.
     * @param {string} msg The message.
     */
    setWorkspaceSyncStatus(msg) {
      this.syncStatus.workspace.status = msg;
      this.syncStatus.workspace.time = new Date();
      this.updateStatus();
    }

    /**
     * Updates the status text.
     */
    updateStatus() {
      document.getElementById("file_sync_status").textContent = `Files: ${
        this.syncStatus.files.status
      } (${this.syncStatus.files.time.toLocaleTimeString()})`;
      document.getElementById("workspace_sync_status").textContent =
        `Workspace: ${
          this.syncStatus.workspace.status
        } (${this.syncStatus.workspace.time.toLocaleTimeString()})`;
    }

    /**
     * Stops all timer operations.
     */
    stop() {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = undefined;
      }
    }
  }

  Module.idbSync = new IDBSync();

  /**
   * Reads a file and write it to the filesystem.
   * @param {File} file The file to read.
   * @returns {Promise<void>}
   */
  function writeFile(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          FS.writeFile(file.destination, new Uint8Array(reader.result));
          res();
        } catch (e) {
          console.log(e);
          rej(new Error(`${file.destination}: ${e.code ? e.code : e}`));
        }
      };
      reader.onerror = rej;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Gets the file from the user and uploads it to a destination directory.
   * @param {string} dest The destination.
   * @param {boolean} [dir] Set this to true to accept directories.
   * @returns {Promise<number>}
   */
  Module.uploadFiles = (dest, dir) => {
    return new Promise((res, rej) => {
      // create a file input, trigger it
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.multiple = true;
      if (dir) fileInput.webkitdirectory = true;
      fileInput.onchange = () => {
        // make file.name actually good
        const inputFiles = Array.from(fileInput.files);
        inputFiles.forEach(
          (f) =>
            (f.destination = `${dest}/${
              f.webkitRelativePath === "" ? f.name : f.webkitRelativePath
            }`),
        );

        // create the directory structure needed
        new Set(
          inputFiles
            .filter((f) => f.webkitRelativePath !== "")
            .map((f) => {
              const segments = pathSegments(f.destination);
              return segments[segments.length - 2];
            })
            .sort((a, b) => a.localeCompare(b)),
        ).forEach(mkdirp);

        // create the files
        Promise.all(inputFiles.map(writeFile))
          .then((v) => res(v.length))
          .catch(rej);
      };
      fileInput.oncancel = () => res();
      fileInput.click();
    });
  };

  /**
   * Automatically downloads a file.
   * @param {File} file The file object.
   */
  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const elem = document.createElement("a");
    elem.style.display = "none";
    elem.href = url;
    document.body.appendChild(elem);
    elem.download = file.name;
    elem.click();
    document.body.removeChild(elem);
    // revoke in 1 minute
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000);
  }

  /**
   * Recursively zips a directory.
   * @param {string} path The path to the directory.
   * @returns {Promise<number>}
   */
  async function fsDownloadDirectory(path) {
    if (!FS.isDir(FS.stat(path).mode)) {
      throw new Error("cannot download non-directories");
    }
    const filename = path.split("/").pop();
    const relPath = path.split("/").slice(0, -1).join("/")

    // recursively read all files into a directory with a DFS
    let count = 0;
    const filesObj = {};
    const stack = [path];
    while (stack.length > 0) {
      const currentEntry = stack.pop();
      const entries = FS.readdir(currentEntry);

      for (const entry of entries) {
        if (entry === "." || entry == "..") continue;
        const fullPath = `${currentEntry}/${entry}`;
        const stat = FS.stat(fullPath);
        if (FS.isDir(stat.mode)) {
          // insert into stack
          stack.push(fullPath);
        } else if (FS.isFile(stat.mode)) {
          const zipPath = fullPath.slice(relPath.length + 1)
          filesObj[zipPath] = [FS.readFile(fullPath), { mtime: stat.mtime }];
          count++;
        }
        // ignore other files
      }
    }

    // create the zip file
    const file = await new Promise((res, rej) => {
      fflate.zip(filesObj, { consume: true, level: 9 }, (err, out) => {
        if (err) {
          rej(err);
        } else {
          res(out);
        }
      });
    });

    // download it
    downloadFile(new File([file], filename, { type: "application/zip" }));

    return count;
  }

  /**
   * Downloads a file.
   * @param {string} path The path.
   * @returns {}
   */
  async function fsDownloadFile(path) {
    const filename = path.split("/").pop();
    console.log(path, filename);
    const content = FS.readFile(path);
    downloadFile(
      new File([content], filename, {
        type: "application/octet-stream",
      }),
    );
    return 1;
  }

  Module.downloadFiles = async function (path) {
    const stat = FS.stat(path);
    if (FS.isDir(stat.mode)) {
      return await fsDownloadDirectory(path);
    } else if (FS.isFile(stat.mode)) {
      return await fsDownloadFile(path);
    }
    return 0;
  };

  let storageReady, runtimeReady, started;
  const start = () => {
    if (runtimeReady && storageReady && !started) {
      started = true;
      console.log("Starting Lite XL...");
      document.getElementById("loading").style.display = "none";
      FS.chdir("/home/web_user");

      // set up autosave
      Module.idbSync.start();
      callMain(Module.arguments);
    }
  };

  Module.thisProgram = "/usr/bin/lite-xl";
  Module.noInitialRun = true;
  Module.preRun.push(() => {
    ENV.LITE_SCALE = window.devicePixelRatio.toString();

    // mount IDBFS in home folder
    mkdirp("/home/web_user");
    FS.mount(IDBFS, {}, "/home/web_user");
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
