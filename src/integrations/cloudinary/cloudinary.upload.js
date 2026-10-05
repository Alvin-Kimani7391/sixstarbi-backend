const { cloudinary, isConfigured } = require('./cloudinary.client');
const ApiError = require('../../utils/ApiError');

const notConfigured = () =>
  new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'File storage is not configured. Set the CLOUDINARY_* variables on the server.');

function upload(buffer, { publicId, resourceType }) {
  if (!isConfigured()) return Promise.reject(notConfigured());
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: resourceType, overwrite: false },
      (err, res) => {
        if (err) return reject(new ApiError(502, 'STORAGE_UPLOAD_FAILED', 'Could not store the file. Please try again.'));
        return resolve({ url: res.secure_url, publicId: res.public_id, bytes: res.bytes });
      }
    );
    stream.end(buffer);
  });
}

module.exports = { upload };