const { z } = require('zod');
const { DATA_PREFERENCES } = require('../constants');

const base = {
  name: z.string().trim().min(2).max(160),
  businessType: z.string().trim().max(80).optional(),
  industry: z.string().trim().max(80).optional(),
  country: z.string().trim().min(2).max(60).default('Kenya'),
  currency: z.string().trim().length(3).toUpperCase().default('KES'),
  numberOfLocations: z.coerce.number().int().min(1).max(500).default(1),
  existingPOS: z.string().trim().max(120).optional(),
  existingInventorySystem: z.string().trim().max(120).optional(),
  dataPreference: z.enum(DATA_PREFERENCES).default('HAVE_DATA'),
};

const createBusiness = z.object(base);
const updateBusiness = z.object(base).partial();

module.exports = { createBusiness, updateBusiness };