const path = require('path');

const starts = (b, sig, at = 0) => sig.every((v, i) => b[at + i] === v);

const KINDS = {
  csv: { resourceType: 'raw', check: (b) => !b.subarray(0, 4096).includes(0) },
  xlsx: { resourceType: 'raw', check: (b) => starts(b, [0x50, 0x4b, 0x03, 0x04]) },
  xls: { resourceType: 'raw', check: (b) => starts(b, [0xd0, 0xcf, 0x11, 0xe0]) },
  pdf: { resourceType: 'raw', check: (b) => starts(b, [0x25, 0x50, 0x44, 0x46]) },
  png: { resourceType: 'image', check: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47]) },
  jpg: { resourceType: 'image', check: (b) => starts(b, [0xff, 0xd8, 0xff]) },
  gif: { resourceType: 'image', check: (b) => starts(b, [0x47, 0x49, 0x46, 0x38]) },
  webp: {
    resourceType: 'image',
    check: (b) => starts(b, [0x52, 0x49, 0x46, 0x46]) && starts(b, [0x57, 0x45, 0x42, 0x50], 8),
  },
};

function detect(file) {
  if (!file || !file.buffer || !file.buffer.length) return null;
  let ext = path.extname(file.originalname || '').slice(1).toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  const k = KINDS[ext];
  if (!k || !k.check(file.buffer)) return null;
  return { kind: ext, ext, resourceType: k.resourceType };
}

module.exports = { detect };