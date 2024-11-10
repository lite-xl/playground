import { ZipFile } from "./zipfile";

export class Interop {
  constructor(FS) {
    this.FS = FS;
  }

  /**
   * Prompts the user to upload a file or directory.
   * @param {string} path destination path.
   * @param {boolean} uploadDirectory whether to upload a file or directory.
   */
  uploadFiles(path, uploadDirectory) {
    return new Promise((res, rej) => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.webkitdirectory = uploadDirectory;
      fileInput.addEventListener("change", () => {
        const readPromises = Array.from(fileInput.files).map((file) =>
          this.writeFile(
            file,
            `${path}/${file.webkitRelativePath ? file.webkitRelativePath : file.name}`,
          ),
        );
        Promise.all(readPromises).then(() => res(readPromises.length), rej);
      });
      fileInput.addEventListener("cancel", () => res(0));
      fileInput.click();
    });
  }

  /**
   * Downloads a path.
   * @param {string} path the path to download
   */
  downloadFiles(path) {
    if (this.FS.isDir(this.FS.stat(path).mode)) {
      return this.downloadDirectory(path);
    } else {
      return this.downloadFile(
        path.split("/").pop(),
        this.FS.readFile(path, { encoding: "binary" }),
      );
    }
  }

  /**
   * Creates a download for the user.
   * @param {string} filename download filename.
   * @param {*} content file content.
   */
  downloadFile(filename, content) {
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
  downloadDirectory(directory) {
    const filename = directory.split("/").pop() ?? "";
    const dirname = this.dirname(directory);

    const zipFile = new ZipFile();
    const stack = [directory];
    while (stack.length) {
      const item = stack.pop();
      const relPath = item.slice(dirname.length);
      const stat = this.FS.stat(item);
      if (this.FS.isDir(stat.mode)) {
        const paths = this.FS.readdir(item)
          .filter((d) => d !== "." && d !== "..")
          .map((d) => `${item}/${d}`);
        if (paths.length) {
          stack.push(...paths);
        } else {
          zipFile.addDirectory(relPath, stat.mtime);
        }
      }
      if (this.FS.isFile(stat.mode)) {
        zipFile.addFile(
          relPath,
          this.FS.readFile(item, { encoding: "binary" }),
          stat.mtime,
        );
      }
    }

    return this.downloadFile(
      `${filename === "" ? "root" : filename}.zip`,
      zipFile.finalize(),
    );
  }

  /**
   * Writes a file to the filesystem.
   * @param {File} file the file to read.
   * @param {string} dest the destination path.
   * @returns {Promise<void>}
   */
  writeFile(file, dest) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        this.FS.createPath("/", this.dirname(dest), true, true);
        this.FS.writeFile(dest, new Uint8Array(reader.result));
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
  dirname(path) {
    const segments = path.split("/").slice(0, -1);
    if (segments.length === 1) return "/";
    return segments.join("/");
  }
}
