const { z } = require('zod');
const { IMPORT_TYPES } = require('../constants');

const typeParam = z.object({ type: z.enum(IMPORT_TYPES) });
const idParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') });
const process = z.object({ mapping: z.record(z.string(), z.string()) });
const list = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PREVIEW', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
});

module.exports = { typeParam, idParam, process, list };