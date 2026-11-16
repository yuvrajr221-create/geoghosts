import { crc32, deflateRawSync } from 'node:zlib';

const MAX_ENTRIES = 0xffff;
const MAX_SIZE = 0xffffffff;

/** Convert a Date to the (time, date) pair used by ZIP headers (local DOS format, UTC here for reproducibility). */
function dosDateTime(date) {
  const year = Math.max(1980, date.getUTCFullYear());
  const time = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1);
  const day = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { time, day };
}

/**
 * Build a ZIP archive in memory (deflate, no ZIP64).
 * @param {{ name: string, data: Buffer | string }[]} files
 * @param {Date} [modified]
 * @returns {Buffer}
 */
export function createZip(files, modified = new Date()) {
  if (files.length > MAX_ENTRIES) throw new RangeError('Too many files for a ZIP archive');
  const { time, day } = dosDateTime(modified);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const raw = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
    const packed = deflateRawSync(raw);
    const checksum = crc32(raw);
    if (raw.length > MAX_SIZE || packed.length > MAX_SIZE) throw new RangeError('File too large for a ZIP archive');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed to extract
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra field length

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory header signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    // 30 extra length, 32 comment length, 34 disk number, 36 internal attrs, 38 external attrs: all zero
    central.writeUInt32LE(offset, 42); // offset of local header

    locals.push(local, name, packed);
    centrals.push(central, name);
    offset += local.length + name.length + packed.length;
  }

  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  if (offset + centralSize > MAX_SIZE) throw new RangeError('Archive too large for a ZIP archive');

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(files.length, 8); // entries on this disk
  end.writeUInt16LE(files.length, 10); // total entries
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16); // central directory offset

  return Buffer.concat([...locals, ...centrals, end]);
}
