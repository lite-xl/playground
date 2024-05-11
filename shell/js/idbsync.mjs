/**
 * Manages syncings from IDBFS to IndexedDB.
 */
export class IDBSync {
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
      `IDBSync autosync: ${this.autoSync}, interval: ${this.saveInterval}`
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
    const promise = new Promise((res, rej) => this.queue.push([id, res, rej]));
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
        debouncePeriod
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
      await new Promise((res, rej) => FS.syncfs((e) => (e ? rej(e) : res(e))));
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
