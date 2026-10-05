const { z } = require('zod');
const { PAYMENT_METHODS } = require('../constants');

const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const num = z.coerce.number().finite();
const page = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
};

const notTooFarAhead = (d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000;

const sale = z.object({
  saleDate: z.coerce.date().refine(notTooFarAhead, 'Sale date cannot be in the future').optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).default('CASH'),
  locationId: oid.optional(),
  items: z.array(z.object({
    productId: oid,
    quantity: num.positive(),
    unitPrice: num.min(0).optional(),
    discount: num.min(0).optional(),
  })).min(1, 'Add at least one item').max(200),
});

const purchase = z.object({
  purchaseDate: z.coerce.date().refine(notTooFarAhead, 'Purchase date cannot be in the future').optional(),
  supplierName: z.string().trim().max(160).optional(),
  status: z.enum(['RECEIVED', 'ORDERED']).default('RECEIVED'),
  locationId: oid.optional(),
  items: z.array(z.object({
    productId: oid, quantity: num.positive(), unitCost: num.min(0),
  })).min(1, 'Add at least one item').max(200),
});

const adjust = z.object({
  productId: oid,
  type: z.enum(['ADJUSTMENT', 'DAMAGE', 'RETURN']),
  quantity: num.refine((v) => v !== 0, 'Quantity cannot be zero'),
  note: z.string().trim().max(300).optional(),
  locationId: oid.optional(),
});

const listSales = z.object({ ...page, from: z.coerce.date().optional(), to: z.coerce.date().optional() });
const listPage = z.object(page);
const listTransactions = z.object({ ...page, productId: oid.optional() });
const idParam = z.object({ id: oid });

module.exports = { sale, purchase, adjust, listSales, listPage, listTransactions, idParam };