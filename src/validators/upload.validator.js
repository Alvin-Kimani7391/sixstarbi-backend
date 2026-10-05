const { z } = require('zod');
const { UPLOAD_FOLDERS } = require('../constants');

const upload = z.object({ folder: z.enum(UPLOAD_FOLDERS).default('documents') });
const idParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') });

module.exports = { upload, idParam };