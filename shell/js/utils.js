/**
 * Maximum number of milliseconds before yielding to event loop.
 */
export const MAX_EVENT_LOOP_DELAY = 6;

/**
 * Read / write buffer size.
 */
const BUFFER_SIZE = 128 * 1024 * 1024;

/**
 * Writes a file to the filesystem.
 * @param {object} FS the emscripten filesystem object.
 * @param {File} path the file to read.
 * @param {string} dest the destination path.
 * @returns {Promise<void>}
 */
export async function writeFile(FS, path, dest) {
  const buffer = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => res(new Uint8Array(reader.result)));
    reader.addEventListener("error", () => rej(reader.error));
    reader.readAsArrayBuffer(path);
  });
  FS.createPath("/", dirname(dest), true, true);
  const file = FS.open(dest, "w");
  let offset = 0,
    lastTime = performance.now();
  while (offset < buffer.byteLength) {
    const writeSize = Math.min(buffer.byteLength - offset, BUFFER_SIZE);
    const written = FS.write(file, buffer, offset, writeSize);
    offset += written;
    if (written !== writeSize) break;
    if (performance.now() - lastTime > MAX_EVENT_LOOP_DELAY) {
      await yieldToEventLoop();
      lastTime = performance.now();
    }
  }
  FS.close(file);
}

/**
 * Reads a file in chunks.
 * @param {object} FS emscripten filesystem object
 * @param {string} path the path to read
 * @param {object?} stat the result of FS.stat, optional
 */
export async function readFile(FS, path, stat) {
  if (!stat) stat = FS.stat(path);
  if (stat.size <= BUFFER_SIZE)
    return FS.readFile(path, { encoding: "binary" });

  const output = [];
  const file = FS.open(path, "r");
  let read,
    lastTime = performance.now();
  do {
    let buf = new Uint8Array(BUFFER_SIZE);
    read = FS.read(file, buf, 0, BUFFER_SIZE);
    if (read > 0)
      output.push(read === BUFFER_SIZE ? buf : new Uint8Array(buf, 0, read));

    if (performance.now() - lastTime > MAX_EVENT_LOOP_DELAY) {
      await yieldToEventLoop();
      lastTime = performance.now();
    }
  } while (read === BUFFER_SIZE);
  FS.close(file);
  return output;
}

/**
 * Yields to the event loop.
 * @returns {Promise<void>}
 */
export async function yieldToEventLoop() {
  await new Promise((res) => setTimeout(res, 0));
}

/**
 * Gets the directory of a path.
 * @param {string} path the path.
 * @returns {string}
 */
export function dirname(path) {
  const segments = path.split("/").slice(0, -1);
  if (segments.length === 1) return "/";
  return segments.join("/");
}

/**
 * Gets an element.
 * @param {string} querySelector query selector
 * @returns
 */
export function $(querySelector) {
  return document.querySelector(querySelector);
}
