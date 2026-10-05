const { z } = require('zod');

const num = z.coerce.number().finite().min(0);
const text = (max) => z.string().trim().max(max);

const fields = {
  name: text(200).min(1),
  sku: text(60),
  barcode: text(60),
  category: text(80),
  brand: text(80),
  unit: text(20),
  purchasePrice: num,
  sellingPrice: num,
  safetyStock: num,
  reorderLevel: num,
  targetStock: num,
  supplierLeadTimeDays: num,
  active: z.boolean(),
  imageUrl: z.string().url().max(500),
  cloudinaryPublicId: text(300),
};

const create = z.object(fields).partial({
  sku: true, barcode: true, category: true, brand: true, unit: true, purchasePrice: true, sellingPrice: true,
  safetyStock: true, reorderLevel: true, targetStock: true, supplierLeadTimeDays: true, active: true,
  imageUrl: true, cloudinaryPublicId: true,
});
const update = z.object(fields).partial();

const list = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().trim().max(100).optional(),
});

const idParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') });

module.exports = { create, update, list, idParam };