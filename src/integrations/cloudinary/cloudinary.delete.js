const { cloudinary, isConfigured } = require('./cloudinary.client');
const ApiError = require('../../utils/ApiError');

async function remove(publicId, resourceType) {
  if (!isConfigured()) throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'File storage is not configured.');
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
  } catch {
    throw new ApiError(502, 'STORAGE_DELETE_FAILED', 'Could not delete the file from storage.');
  }
}

module.exports = { remove };