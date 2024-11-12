import { ZipFile } from "./zipfile";

/**
 * Number of conccurent uploads to run.
 * Keep this small.
 */
const UPLOAD_CHUNK_SIZE = 5;

/**
 * @callback UploadProgressCallback
 * @param {number} items number of items uploaded
 * @param {number} remaining number of items remaining
 */

/**
 * Allows interop between C and JS.
 */
export class Interop {
  #FS;
  #promiseRegistryCounter = 1;
  #promiseRegistry = new Map();
  #perFrameInhibit = false;

  constructor(FS) {
    this.#FS = FS;
  }

  /**
   * Prompts the user to upload a file or directory.
   * @param {string} path destination path.
   * @param {boolean} uploadDirectory whether to upload a file or directory.
   */
  uploadFiles(path, uploadDirectory) {
    const {
      promise,
      resolve: res,
      reject: rej,
    } = this.#createPromise("upload");
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
        for (let i = 0; i < fileInput.files.length; i += UPLOAD_CHUNK_SIZE) {
          const chunk = Array.prototype.slice.call(
            fileInput.files,
            i,
            i + UPLOAD_CHUNK_SIZE,
          );
          await Promise.all(
            chunk.map(async (file) => {
              const filePath = `${path}/${file.webkitRelativePath ? file.webkitRelativePath : file.name}`;
              await this.#writeFile(file, filePath);
              promise["read"]++;
            }),
          );
          this.#notifyPromisesUpdate(promise["id"]);
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
   * @param {string} path the path to download
   */
  downloadFiles(path) {
    if (this.#FS.isDir(this.#FS.stat(path).mode)) {
      return this.#downloadDirectory(path);
    } else {
      return this.#downloadFile(
        path.split("/").pop(),
        this.#FS.readFile(path, { encoding: "binary" }),
      );
    }
  }

  /**
   * Creates a download for the user.
   * @param {string} filename download filename.
   * @param {*} content file content.
   */
  #downloadFile(filename, content) {
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
   * Downloads a directory as a ZIP file.
   * @param {string} directory
   */
  #downloadDirectory(directory) {
    const filename = directory.split("/").pop() ?? "";
    const dirname = this.#dirname(directory);

    const zipFile = new ZipFile();
    const stack = [directory];
    while (stack.length) {
      const item = stack.pop();
      const relPath = item.slice(dirname.length);
      const stat = this.#FS.stat(item);
      if (this.#FS.isDir(stat.mode)) {
        const paths = this.#FS
          .readdir(item)
          .filter((d) => d !== "." && d !== "..")
          .map((d) => `${item}/${d}`);
        if (paths.length) {
          stack.push(...paths);
        } else {
          zipFile.addDirectory(relPath, stat.mtime);
        }
      }
      if (this.#FS.isFile(stat.mode)) {
        zipFile.addFile(
          relPath,
          this.#FS.readFile(item, { encoding: "binary" }),
          stat.mtime,
        );
      }
    }

    return this.#downloadFile(
      `${filename === "" ? "root" : filename}.zip`,
      zipFile.finalize(),
    );
  }

  //#region C Promises Interface
  /**
   * Creates a promise.
   * @param {string?} type the type of promise
   * @returns {{promise: Promise, resolve: Function, reject: Function }}
   */
  #createPromise(type) {
    let resolve, reject;
    const id = this.#promiseRegistryCounter++;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    })
      .then(() => {
        promise["done"] = true;
        this.#notifyPromisesUpdate(promise["id"]);
      })
      .catch((error) => {
        promise["done"] = true;
        promise["error"] = error;
        this.#notifyPromisesUpdate(promise["id"]);
        throw error;
      });
    promise["id"] = id;
    promise["type"] = type;
    this.#promiseRegistry.set(id, promise);
    return { promise, resolve, reject };
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

  /**
   * Notifies the WASM side that a promise is updated, and they should check it out.
   * @param {number?} id a promise ID as a hint
   */
  #notifyPromisesUpdate(id) {
    if (!this.#perFrameInhibit) {
      // wake up SDL
      const event = new FocusEvent("focusin");
      window.dispatchEvent(event);
      // to prevent spamming this handler, we only allow it to fire once per event loop iteration
      this.#perFrameInhibit = setTimeout(() => {
        this.#perFrameInhibit = undefined;
      }, 0);
    }
  }
  //#endregion

  //#region File IO
  /**
   * Writes a file to the filesystem.
   * @param {File} file the file to read.
   * @param {string} dest the destination path.
   * @returns {Promise<void>}
   */
  #writeFile(file, dest) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        this.#FS.createPath("/", this.#dirname(dest), true, true);
        this.#FS.writeFile(dest, new Uint8Array(reader.result));
        res();
      });
      reader.addEventListener("error", () => rej(reader.error));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Gets the directory of a path.
   * @param {string} path the path.
   * @returns
   */
  #dirname(path) {
    const segments = path.split("/").slice(0, -1);
    if (segments.length === 1) return "/";
    return segments.join("/");
  }
  //#endregion

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
