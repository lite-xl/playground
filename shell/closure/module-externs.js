/**
 * @externs
 * @suppress {duplicate, undefinedVars}
 */
var Module = {};

/**
 * @externs
 */
Module.idbSync = {};

/**
 * @externs
 * @param {number} interval
 */
Module.idbSync.setInterval = function (interval) {};

/**
 * @externs
 * @return {!number}
 */
Module.idbSync.getInterval = function () {};

/**
 * @externs
 * @param {boolean} enabled
 */
Module.idbSync.setAutoSync = function (enabled) {};

/**
 * @externs
 * @return {!boolean}
 */
Module.idbSync.getAutoSync = function () {};

/**
 * @externs
 */
Module.idbSync.start = function () {};

/**
 * @externs
 * @returns {Promise<void>}
 */
Module.idbSync.save = function () {};

/**
 * @externs
 * @param {number} debouncePeriod
 * @returns {Promise<void>}
 */
Module.idbSync.saveDebounced = function (debouncePeriod) {};

/**
 * @externs
 * @param {string} msg
 */
Module.idbSync.setWorkspaceSyncStatus = function (msg) {};

/**
 * @externs
 */
Module.idbSync.stop = function () {};

/**
 * @externs
 * @param {string} dest
 * @param {boolean} dir
 * @returns {Promise<number>}
 */
Module.uploadFiles = function (dest, dir) {};

/**
 * @externs
 * @param {string} path
 * @returns {Promise<number>}
 */
Module.downloadFiles = function (path) {};

/**
 * @suppress {duplicate, undefinedVars}
 */
var err;
