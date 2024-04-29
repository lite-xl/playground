var Module = {
  preRun: [],
};
(() => {
  'use strict';

  /**
   * Creates a directory.
   * @param {string} dir The directory.
   */
  function mkdir(dir) {
    try {
      FS.mkdir(dir);
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
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
      console.log(`IDBSync autosync: ${this.autoSync}, interval: ${this.saveInterval}`);
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
      console.log('Save ID: ', id);
      const promise = new Promise((res, rej) => this.queue.push([id, res, rej]));
      this.execQueue();
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
        this.debounceTimer = setTimeout(() => this.save().then(res).catch(rej), debouncePeriod);
      });
    }

    /**
     * Finishes all sync operations on the queue.
     */
    async execQueue() {
      if (this.queue.length === 0) {
        // wait for more items (by using sleep)
        return this.start();
      }
      const [id, res, rej] = this.queue.shift();
      this.setStatus('Saving...');
      try {
        await new Promise((res, rej) => FS.syncfs(e => e ? rej(e) : res(e)));
        this.setStatus(`Saved at ${new Date().toLocaleTimeString()}`);
        console.log('Save completed, ID: ', id);
        res();
      } catch (e) {
        this.setStatus('Cannot sync. Please check your console.');
        console.error('syncfs() failed:', e);
        rej(e);
      }
      // technically we have TCO, but it really dont exist.        
      return this.execQueue();
    }

    /**
     * Sets the status text in the top-right corner.
     * @param {string} msg The message.
     */
    setStatus(msg) {
      if (!this.statusText)
        this.statusText = document.getElementById('status_text');
      this.statusText.textContent = `Sync: ${msg}`;
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

  let storageReady, runtimeReady, started;
  const start = () => {
    if (runtimeReady && storageReady && !started) {
      started = true;
      console.log('Starting Lite XL...');
      document.getElementById('loading').style.display = 'none';
      FS.chdir('/home/web_user');

      // set up autosave
      Module.idbSync.start();
      callMain(Module.arguments);
    }
  };

  Module.arguments = ['/usr/share/lite-xl/welcome.md'];
  Module.thisProgram = '/usr/bin/lite-xl';
  Module.noInitialRun = true;
  Module.preRun.push(() => {
    ENV.LITE_SCALE = window.devicePixelRatio.toString();

    // mount IDBFS in home folder
    mkdir('/home');
    mkdir('/home/web_user');
    FS.mount(IDBFS, {}, '/home/web_user');
    FS.syncfs(true, (e) => {
      if (e) {
        console.error('syncfs(true) failed: ', e);
      } else {
        storageReady = true;
        start();
      }
    });
  });
  Module.onExit = () => {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('canvas').style.display = 'none';
    document.getElementById('close').style.display = 'block';
  };
  Module.onRuntimeInitialized = () => {
    runtimeReady = true;
    start();
  };

  // attach canvas to module
  window.onload = () => {
    const status = document.getElementById('status');
    Module.canvas = document.getElementById('canvas');
    Module.canvas.oncontextmenu = (e) => e.preventDefault();
    Module.setStatus = (s) => {
      status.textContent = s === '' ? 'Initializing...' : s;
    };
  };
})();