/**
 * @file Advanced options to clear cache.
 * @author takase1121
 */

/**
 * Wraps a IDBRequest.
 * @param {IDBOpenDBRequest} req
 * @returns
 */
function wrapIDBRequest(req) {
  return new Promise((res, rej) => {
    req.onsuccess = res;
    req.onerror = rej;
    req.onblocked = rej;
  });
}

/**
 * Purges a list of databases.
 * @param {string[]} nameList
 */
async function purgeDB(nameList) {
  try {
    await Promise.all(
      nameList.map((name) => wrapIDBRequest(indexedDB.deleteDatabase(name)))
    );
    alert("Database purged successfully.");
  } catch (e) {
    alert(
      `Database purge failed: ${e instanceof Error ? e : "Database is in use"}`
    );
    console.error(e);
  }
}

window.addEventListener("load", () => {
  document
    .getElementById("purge_preload")
    .addEventListener("click", () => purgeDB(["EM_PRELOAD_CACHE"]));
  document
    .getElementById("purge_all")
    .addEventListener(
      "click",
      async () =>
        await purgeDB((await indexedDB.databases()).map((db) => db.name))
    );
});
