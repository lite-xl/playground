/**
 * @file Filesystem related utilities.
 * @author takase1121
 */

import { zip } from "fflate";
import { FS } from "./env.mjs";

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
    (x, i, a) => a.slice(0, i + 1).join("/") + (x === "" ? "/" : "")
  );
}

/**
 * Creates a directory.
 * @param {string} dir The directory.
 */
export function mkdirp(dir) {
  for (const segment of pathSegments(dir)) {
    try {
      FS.mkdir(segment);
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
}

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
export function uploadFiles(dest, dir) {
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
          }`)
      );

      // create the directory structure needed
      new Set(
        inputFiles
          .filter((f) => f.webkitRelativePath !== "")
          .map((f) => {
            const segments = pathSegments(f.destination);
            return segments[segments.length - 2];
          })
          .sort((a, b) => a.localeCompare(b))
      ).forEach(mkdirp);

      // create the files
      Promise.all(inputFiles.map(writeFile))
        .then((v) => res(v.length))
        .catch(rej);
    };
    fileInput.oncancel = () => res(0);
    fileInput.click();
  });
}

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
  const relPath = path.split("/").slice(0, -1).join("/");

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
        const zipPath = fullPath.slice(relPath.length + 1);
        filesObj[zipPath] = [FS.readFile(fullPath), { mtime: stat.mtime }];
        count++;
      }
      // ignore other files
    }
  }

  // create the zip file
  const file = await new Promise((res, rej) => {
    zip(filesObj, { consume: true, level: 9 }, (err, out) => {
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
  const content = FS.readFile(path);
  downloadFile(
    new File([content], filename, {
      type: "application/octet-stream",
    })
  );
  return 1;
}

/**
 * Downloads a file or directory.
 * @param {string} path The path to the file or directory.
 * @returns the number of files downloaded.
 */
export async function downloadFiles(path) {
  const stat = FS.stat(path);
  if (FS.isDir(stat.mode)) {
    return await fsDownloadDirectory(path);
  } else if (FS.isFile(stat.mode)) {
    return await fsDownloadFile(path);
  }
  return 0;
}
