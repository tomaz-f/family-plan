export interface ZipEntryInput {
  path: string;
  content: string;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(view: DataView, offset: number, val: number): void {
  view.setUint16(offset, val & 0xffff, true);
}

function writeU32(view: DataView, offset: number, val: number): void {
  view.setUint32(offset, val >>> 0, true);
}

/**
 * Builds a valid uncompressed (STORE) ZIP archive in memory.
 * When `mimetype` is passed as the first entry, it is stored uncompressed
 * at offset 0 with zero extra field bytes, satisfying OpenDocument (ODF 1.2).
 */
export function buildZipArchiveBlob(
  entries: ZipEntryInput[],
  mimeType = 'application/vnd.oasis.opendocument.spreadsheet'
): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const dataBytes = encoder.encode(entry.content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    writeU32(lv, 0, 0x04034b50); // Local file header signature
    writeU16(lv, 4, 20); // Version needed to extract (2.0)
    writeU16(lv, 6, 0x0800); // UTF-8 filename flag
    writeU16(lv, 8, 0); // Compression method 0 (STORE)
    writeU16(lv, 10, 0); // Mod time
    writeU16(lv, 12, 0x5969); // Mod date
    writeU32(lv, 14, crc);
    writeU32(lv, 18, size);
    writeU32(lv, 22, size);
    writeU16(lv, 26, nameBytes.length);
    writeU16(lv, 28, 0); // Extra field length = 0 (required for ODF mimetype)
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    writeU32(cv, 0, 0x02014b50); // Central directory signature
    writeU16(cv, 4, 20); // Version made by
    writeU16(cv, 6, 20); // Version needed
    writeU16(cv, 8, 0x0800); // UTF-8 flag
    writeU16(cv, 10, 0); // Method 0 (STORE)
    writeU16(cv, 12, 0);
    writeU16(cv, 14, 0x5969);
    writeU32(cv, 16, crc);
    writeU32(cv, 20, size);
    writeU32(cv, 24, size);
    writeU16(cv, 28, nameBytes.length);
    writeU16(cv, 30, 0); // Extra length
    writeU16(cv, 32, 0); // Comment length
    writeU16(cv, 34, 0); // Disk number
    writeU16(cv, 36, 0); // Internal attrs
    writeU32(cv, 38, 0); // External attrs
    writeU32(cv, 42, localOffset);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    localOffset += localHeader.length + size;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  writeU32(ev, 0, 0x06054b50); // End of central directory signature
  writeU16(ev, 4, 0);
  writeU16(ev, 6, 0);
  writeU16(ev, 8, entries.length);
  writeU16(ev, 10, entries.length);
  writeU32(ev, 12, centralSize);
  writeU32(ev, 16, localOffset);
  writeU16(ev, 20, 0);

  const totalSize = localOffset + centralSize + eocd.length;
  const archive = new Uint8Array(totalSize);
  let cursor = 0;
  for (const part of localParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  archive.set(eocd, cursor);

  return new Blob([archive.buffer], { type: mimeType });
}
