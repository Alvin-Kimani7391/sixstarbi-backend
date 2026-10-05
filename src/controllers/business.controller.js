const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const businessService = require('../services/business.service');
const audit = require('../services/audit.service');

const create = asyncHandler(async (req, res) => {
  const business = await businessService.createBusiness(req.user, req.body);
  await audit.record(req, 'BUSINESS_CREATED', {
    businessId: business._id, entityType: 'Business', entityId: business._id,
  });
  created(res, { business });
});

const get = asyncHandler(async (req, res) => {
  const business = await businessService.getBusiness(req.businessId);
  ok(res, { business });
});

const update = asyncHandler(async (req, res) => {
  const business = await businessService.updateBusiness(req.businessId, req.body);
  await audit.record(req, 'BUSINESS_UPDATED', { entityType: 'Business', entityId: business._id });
  ok(res, { business });
});

const locations = asyncHandler(async (req, res) => {
  ok(res, { locations: await businessService.listLocations(req.businessId) });
});

module.exports = { create, get, update, locations };