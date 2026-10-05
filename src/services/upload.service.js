const crypto = require('crypto');
const path = require('path');
const repo = require('../repositories/asset.repository');
const importRepo = require('../repositories/import.repository');
const fileValidation = require('../utils/fileValidation');
const cloudUpload = require('../integrations/cloudinary/cloudinary.upload');
const cloudDelete = require('../integrations/cloudinary/cloudinary.delete');
const helpers = require('../integrations/cloudinary/cloudinary.helpers');
const ApiError = require('../utils/ApiError');

const IMAGES = ['jpg', 'png', 'webp', 'gif'];
const FOLDER_KINDS = {
  products: IMAGES,
  logos: IMAGES,
  imports: ['csv', 'xlsx', 'xls'],
  documents: ['pdf', 'csv', 'xlsx', 'xls', ...IMAGES],
  reports: ['pdf', 'xlsx', 'csv'],
};

const cleanName = (n) =>
  path.basename(String(n || 'file')).replace(/[\u0000-\u001f<>:"|?*]/g, '').slice(0, 200) || 'file';

/** Stores an already-validated file. Used by upload() and by the import pipeline. */
async function store({ businessId, userId, folder, file, kind }) {
  const publicId =
    `${helpers.businessFolder(businessId, folder)}/${crypto.randomUUID()}` +
    (kind.resourceType === 'raw' ? `.${kind.ext}` : '');
  const stored = await cloudUpload.upload(file.buffer, { publicId, resourceType: kind.resourceType });
  try {
    return await repo.create({
      businessId, userId, folder, resourceType: kind.resourceType,
      cloudinaryUrl: stored.url, cloudinaryPublicId: stored.publicId,
      fileName: cleanName(file.originalname), fileSize: file.size, mimeType: file.mimetype,
    });
  } catch (err) {
    // Never leave an orphaned file in Cloudinary.
    await cloudDelete.remove(stored.publicId, kind.resourceType).catch(() => {});
    throw err;
  }
}

async function upload({ user, businessId, folder, file }) {
  const kind = fileValidation.detect(file);
  const allowed = FOLDER_KINDS[folder] || [];
  if (!kind || !allowed.includes(kind.kind)) {
    throw ApiError.badRequest(
      `This file is not allowed in "${folder}". Allowed types: ${allowed.join(', ')}.`, 'FILE_TYPE_NOT_ALLOWED'
    );
  }
  return store({ businessId, userId: user._id, folder, file, kind });
}

async function getAsset(businessId, id) {
  const asset = await repo.findById(businessId, id);
  if (!asset) throw ApiError.notFound('File not found');
  return asset;
}

const download = (asset) => helpers.fetchBuffer(asset.cloudinaryUrl);

async function remove(businessId, id) {
  const asset = await getAsset(businessId, id);
  if (await importRepo.isAssetInUse(businessId, asset._id)) {
    throw ApiError.conflict('This file belongs to an import and cannot be deleted.', 'ASSET_IN_USE');
  }
  await cloudDelete.remove(asset.cloudinaryPublicId, asset.resourceType);
  await repo.remove(businessId, asset._id);
}

module.exports = { upload, store, getAsset, download, remove };