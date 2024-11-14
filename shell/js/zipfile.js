const ZIP_LOCAL_MAGIC = 0x04034b50;
const ZIP_CENTRAL_MAGIC = 0x02014b50;
const ZIP_EOCD_MAGIC = 0x06054b50;
const ZIP_MIN_VERSION = 0x14;
const ZIP_UTF8_FLAG = 1 << 11;

const ZIP_LOCAL_HEADER_SIZE = 30;
const ZIP_CENTRAL_HEADER_SIZE = 46;
const ZIP_EOCD_SIZE = 22;

/**
 * Content reading callback.
 * @callback ContentReaderCallback
 * @param {Uint8Array} buffer the buffer to read into
 * @param {number} offset the offset to read into
 * @param {length} length the number of bytes to read
 * @returns {number} number of bytes read
 */

/**
 * Simple ZIP file writer.
 */
export class ZipFile {
  #encoder = new TextEncoder();
  #entries = [];
  #output = [];
  #offset = 0;
  #CRC32_LOOKUP = new Int32Array(256);

  /**
   * Creates a ZIP file writer.
   */
  constructor() {
    // seed the crc lookup table
    for (let i = 0; i <= 256; i++) {
      let crc = i;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1 && -306674912) ^ (crc >>> 1);
      }
      this.#CRC32_LOOKUP[i] = crc;
    }
  }

  /**
   * Adds a file into the ZIP file.
   * @param {string} path file path in ZIP file
   * @param {Uint8Array[]} content ZIP file content
   * @param {Date} modTime modification time of the file
   */
  async addFile(path, content, modTime) {
    modTime = modTime ?? new Date();
    content = Array.isArray(content) ? content : content ? [content] : [];
    const encodedPath = this.#encoder.encode(path);
    const [dosTime, dosDate] = this.#dostime(modTime);
    const crc32 = content.reduce((prev, data) => this.#crc32(data, prev), 0);
    const size = content.reduce((prev, data) => prev + data.byteLength, 0);
    const entry = {
      encodedPath,
      dosTime,
      dosDate,
      crc32,
      size,
      offset: this.#offset,
    };
    const header = new DataView(new ArrayBuffer(ZIP_LOCAL_HEADER_SIZE));
    const writeLE16 = (offset, data) => header.setUint16(offset, data, true);
    const writeLE32 = (offset, data) => header.setUint32(offset, data, true);
    writeLE32(0, ZIP_LOCAL_MAGIC);
    writeLE16(4, ZIP_MIN_VERSION);
    writeLE16(6, ZIP_UTF8_FLAG);
    writeLE16(8, 0); // store
    writeLE16(10, dosTime);
    writeLE16(12, dosDate);
    writeLE32(14, crc32);
    writeLE32(18, size);
    writeLE32(22, size);
    writeLE16(26, encodedPath.byteLength);
    writeLE16(28, 0); // extra field length
    this.#output.push(header, encodedPath, ...content);
    this.#entries.push(entry);
    this.#offset += ZIP_LOCAL_HEADER_SIZE + encodedPath.byteLength + size;
  }

  /**
   * Adds a directory to the ZIP file.
   * This is not needed for non-empty directories.
   * @param {string} path directory path
   * @param {Date?} modTime directory modification time
   */
  addDirectory(path, modTime) {
    this.addFile(`${path}/`, null, modTime);
  }

  /**
   * Writes the global headers and EOCD.
   * @returns {ArrayBufferLike[]}
   */
  finalize() {
    const oldOffset = this.#offset;
    for (const entry of this.#entries) {
      const header = new DataView(new ArrayBuffer(ZIP_CENTRAL_HEADER_SIZE));
      const writeLE16 = (offset, data) => header.setUint16(offset, data, true);
      const writeLE32 = (offset, data) => header.setUint32(offset, data, true);
      writeLE32(0, ZIP_CENTRAL_MAGIC);
      writeLE16(4, 0); // made by DOS
      writeLE16(6, ZIP_MIN_VERSION); // made by DOS
      writeLE16(8, ZIP_UTF8_FLAG);
      writeLE16(10, 0); // store
      writeLE16(12, entry.dosTime);
      writeLE16(14, entry.dosDate);
      writeLE32(16, entry.crc32);
      writeLE32(20, entry.size);
      writeLE32(24, entry.size);
      writeLE16(28, entry.encodedPath.byteLength);
      writeLE16(30, 0); // extra field length
      writeLE16(32, 0); // comment length
      writeLE16(34, 0); // disk start
      writeLE16(36, 0); // internal attr
      writeLE16(38, 0); // external attr
      writeLE32(42, entry.offset); // local header offset
      this.#output.push(header.buffer);
      this.#output.push(entry.encodedPath);
      this.#offset += header.byteLength + entry.encodedPath.byteLength;
    }
    const eocd = new DataView(new ArrayBuffer(ZIP_EOCD_SIZE));
    const writeEOCDLE16 = (offset, data) => eocd.setUint16(offset, data, true);
    const writeEOCDLE32 = (offset, data) => eocd.setUint32(offset, data, true);
    writeEOCDLE32(0, ZIP_EOCD_MAGIC);
    writeEOCDLE16(4, 0); // number of disk
    writeEOCDLE16(6, 0); // cd disk start
    writeEOCDLE16(8, this.#entries.length); // number of records (disk)
    writeEOCDLE16(10, this.#entries.length); // number of records (total)
    writeEOCDLE32(12, this.#offset - oldOffset); // cd size
    writeEOCDLE32(16, oldOffset); // cd offset
    writeEOCDLE16(20, 0); // comment length
    this.#output.push(eocd);
    return this.#output;
  }

  /**
   * Converts a Date object to dos time and date stamps.
   * @param {Date} date
   * @returns {[number, number]} DOS time followed by date
   */
  #dostime(date) {
    let year, month, day, hour, minute, second;
    if (date.getFullYear() < 1980) {
      year = 1980;
      month = day = hour = minute = second = 0;
    } else {
      year = date.getFullYear();
      month = date.getMonth();
      day = date.getDate();
      hour = date.getHours();
      minute = date.getMinutes();
      second = date.getSeconds();
    }
    return [
      (((hour << 11) & 0xf800) |
        ((minute << 5) & 0x7e0) |
        ((second >> 1) & 0x1f)) &
        0xffff,
      ((((year - 1980) << 9) & 0xfe00) |
        (((month + 1) << 5) & 0x1e0) |
        (day & 0x1f)) &
        0xffff,
    ];
  }

  /**
   * Calculates the CRC32 checksum.
   * @param {Uint8Array} data
   * @param {number} previous
   */
  #crc32(data, previous) {
    let crc = ~previous;
    for (let i = 0; i < data.byteLength; i++) {
      crc = this.#CRC32_LOOKUP[(crc & 255) ^ data[i]] ^ (crc >>> 8);
    }
    return ~crc;
  }
}
