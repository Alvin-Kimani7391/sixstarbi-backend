const ApiError = require('../../utils/ApiError');

const ROOT = 'six-star-intelligence';
const businessFolder = (businessId, folder) => `${ROOT}/businesses/${businessId}/${folder}`;

// Only ever fetches URLs we stored ourselves, and refuses anything off Cloudinary.
async function fetchBuffer(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.hostname !== 'res.cloudinary.com') {
    throw new ApiError(500, 'BAD_STORAGE_URL', 'Stored file location is invalid.');
  }
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(502, 'STORAGE_DOWNLOAD_FAILED', `Could not read the stored file (status ${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { businessFolder, fetchBuffer };