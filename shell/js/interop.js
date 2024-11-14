import { ZipFile } from "./zipfile";
import { readFile, writeFile, dirname } from "./utils";

/**
 * The number of files that must be processed before progress is reported.
 */
const PROGRESS_REPORT_SIZE = 10;

/**
 * Prompts the user to upload a file or directory.
 * @param {PromiseRegistry} promiseRegistry the promise registry.
 * @param {object} FS the filesystem object.
 * @param {string} path destination path.
 * @param {boolean} uploadDirectory whether to upload a file or directory.
 */
export function uploadFiles(promiseRegistry, FS, path, uploadDirectory) {
  const {
    promise,
    resolve: res,
    reject: rej,
  } = promiseRegistry.createPromise("upload");
  promise["status"] = "pending";
  promise["read"] = 0;
  promise["total"] = 0;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.webkitdirectory = uploadDirectory;
  fileInput.addEventListener("change", async () => {
    promise["status"] = "selected";
    promise["total"] = fileInput.files.length;

    try {
      let i = 0;
      for (const file of fileInput.files) {
        const filePath = `${path}/${file.webkitRelativePath ? file.webkitRelativePath : file.name}`;
        await writeFile(FS, file, filePath);
        promise["read"]++;
        promise["last"] = filePath;
        if (++i % PROGRESS_REPORT_SIZE === 0)
          promiseRegistry.notifyPromisesUpdate(promise["id"]);
      }
      res(fileInput.files.length);
    } catch (err) {
      rej(err);
    }
  });

  fileInput.addEventListener("cancel", () => {
    promise["status"] = "canceled";
    res(0);
  });
  fileInput.click();

  return promise;
}

/**
 * Downloads a path.
 * @param {PromiseRegistry} promiseRegistry the promise registry
 * @param {object} FS the emscripten filesystem
 * @param {string} path the path to download
 */
export function downloadFiles(promiseRegistry, FS, path) {
  const { promise, resolve, reject } =
    promiseRegistry.createPromise("download");
  promise["read"] = 0;

  if (FS.isDir(FS.stat(path).mode)) {
    downloadDirectory(FS, path, (read, last) => {
      promise["read"] = read;
      promise["last"] = last;
    }).then(resolve, reject);
  } else {
    readFile(FS, path)
      .then((content) => {
        downloadFile(path.split("/").pop(), content);
        promise["read"] = 1;
        promise["last"] = path;
        resolve(1);
      })
      .catch(reject);
  }
  return promise;
}

/**
 * Creates a download for the user.
 * @param {string} filename download filename.
 * @param {*} content file content.
 */
function downloadFile(filename, content) {
  const a = document.createElement("a");
  const blob = new Blob(Array.isArray(content) ? content : [content], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000); // remove after 1 minute
}

/**
 * @callback DownloadProgressCallback
 * @param {number} items number of items downloaded
 */

/**
 * Downloads a directory as a ZIP file.
 * @param {object} FS emscripten filesystem
 * @param {string} directory
 * @param {DownloadProgressCallback} progressCallback
 */
async function downloadDirectory(FS, directory, progressCallback) {
  const filename = directory.split("/").pop() ?? "";
  const dir = dirname(directory);

  const zipFile = new ZipFile();
  const stack = [directory];
  let numFiles = 0;
  while (stack.length) {
    const item = stack.pop();
    const relPath = item.slice(dir.length + 1);
    try {
      const stat = FS.stat(item);
      if (FS.isDir(stat.mode)) {
        const paths = FS.readdir(item)
          .filter((d) => d !== "." && d !== "..")
          .map((d) => `${item}/${d}`);
        if (paths.length) {
          stack.push(...paths);
        } else {
          zipFile.addDirectory(relPath, stat.mtime);
        }
      }
      if (FS.isFile(stat.mode)) {
        const content = await readFile(FS, item, stat);
        zipFile.addFile(relPath, content, stat.mtime);
        if (++numFiles % PROGRESS_REPORT_SIZE === 0)
          progressCallback(numFiles, item);
      }
    } catch (err) {
      console.warn(`Failed to process ${item}: ${err}`);
    }
  }
  downloadFile(
    `${filename === "" ? "root" : filename}.zip`,
    zipFile.finalize(),
  );
  return numFiles;
}

//#region Promise Registry
/**
 * Allows interop between C and JS.
 */
export class PromiseRegistry {
  #promiseHandler;
  #perFrameInhibit;
  #promiseRegistryCounter = 1;
  #promiseRegistry = new Map();

  constructor(promiseHandler) {
    this.#promiseHandler = promiseHandler;
  }

  /**
   * Creates a promise.
   * @param {string?} type the type of promise
   * @returns {{promise: Promise, resolve: Function, reject: Function }}
   */
  createPromise(type) {
    let resolve, reject;
    const id = this.#promiseRegistryCounter++;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    })
      .then(() => {
        promise["done"] = true;
        setTimeout(() => this.notifyPromisesUpdate(promise["id"]), 0);
      })
      .catch((error) => {
        promise["done"] = true;
        promise["error"] = error;
        setTimeout(() => this.notifyPromisesUpdate(promise["id"]), 0);
        throw error;
      });
    promise["id"] = id;
    promise["type"] = type;
    this.#promiseRegistry.set(id, promise);
    return { promise, resolve, reject };
  }

  /**
   * Notifies the WASM side that a promise is updated, and they should check it out.
   * @param {number?} id a promise ID as a hint
   */
  notifyPromisesUpdate(id) {
    if (!this.#perFrameInhibit) {
      this.#promiseHandler(id ?? 0);
      // to prevent spamming this handler, we only allow it to fire once per event loop iteration
      this.#perFrameInhibit = setTimeout(
        () => (this.#perFrameInhibit = undefined),
        0,
      );
    }
  }

  /**
   * Gets running / completed promises, serialized.
   * This will also remove any completed promises after returning them.
   * @param {string?} type the type of promises to filter. Can be undefined for all.
   */
  getPromisesSerialized(type) {
    return this.#serialize(this.#getPromises(type));
  }

  /**
   * Gets running / completed promises.
   * This will also remove any completed promises after returning them.
   * @param {string?} type the type of promises to filter. Can be undefined for all.
   */
  #getPromises(type) {
    const output = [];
    for (const [id, promise] of this.#promiseRegistry) {
      if (!type || promise["type"] === type) output.push(promise);
      if (promise["done"]) this.#promiseRegistry.delete(id);
    }
    return output;
  }

  //#region Serialization
  /**
   * Serializes an object.
   * @param {*} obj the object to serialize
   * @returns {number[]}
   */
  #serialize(obj) {
    const output = ["return "];
    this.#serializeObject(output, obj, new Set());
    return output.join("");
  }

  /**
   * Serializes an object.
   * @param {string[]} output the output
   * @param {*} obj value
   * @param {Set<object>} refs A set of references, used to detect cyclic objects.
   */
  #serializeObject(output, obj, refs) {
    if (this.#serializePrimitive(output, obj)) {
      return output.length;
    } else if (
      typeof obj === "object" &&
      !refs.has(obj) &&
      typeof obj[Symbol.iterator] === "function"
    ) {
      refs.add(obj);
      output.push("{");
      for (const v of obj) {
        // replace value with undefined if the item cannot be serialized
        if (!this.#serializeObject(output, v, refs))
          this.#serializePrimitive(output, undefined);
        output.push(",");
      }
      return output.push("}");
    } else if (typeof obj == "object" && !refs.has(obj)) {
      refs.add(obj);
      output.push("{");
      // serialize each key, value entries
      const entries = Object.entries(obj);
      entries.forEach(([key, value]) => {
        const beforeOffset = output.length;
        output.push("[");
        if (!this.#serializeObject(output, key, refs))
          output.length = beforeOffset;
        output.push("]=");
        if (!this.#serializeObject(output, value, refs))
          output.length = beforeOffset;
        output.push(",");
      });
      return output.push("}");
    }
  }

  /**
   * Serializes a JavaScript primitive.
   * @param {number[]} output the output
   * @param {*} obj value
   * @returns {number?} returns a number if the primitive can be serialized
   */
  #serializePrimitive(output, obj) {
    if (obj === undefined || obj == null) {
      return output.push("nil");
    } else if (typeof obj === "boolean") {
      return output.push(obj.toString());
    } else if (typeof obj === "string") {
      return output.push(
        '"',
        obj
          .replace('"', '\\"')
          .replace(/[^ -~]/g, (v) => `\\u{${v.charCodeAt(0).toString(16)}}`),
        '"',
      );
    } else if (ArrayBuffer.isView(obj)) {
      const bytes = new Uint8ClampedArray(
        obj.buffer,
        obj.byteOffset,
        obj.byteLength,
      );
      return output.push(
        '"',
        bytes.map((b) => `\\x${b.toString(16).padStart(2, "0")}`).join(""),
        '"',
      );
    } else if (typeof obj === "number") {
      if (Number.isNaN(obj)) {
        return output.push("(0/0)");
      } else if (!Number.isFinite(obj)) {
        return output.push(
          obj * Number.POSITIVE_INFINITY === Number.POSITIVE_INFINITY
            ? "(1/0)"
            : "-(1/0)",
        );
      }
      return output.push(obj.toString());
    }
  }
  //#endregion
}
//#endregion
