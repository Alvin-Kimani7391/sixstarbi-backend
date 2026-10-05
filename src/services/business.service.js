const Business = require('../models/Business');
const Location = require('../models/Location');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants');

async function createBusiness(user, payload) {
  if (user.businessId) {
    throw ApiError.conflict('You already have a business', 'BUSINESS_EXISTS');
  }

  const business = await Business.create({
    ...payload,
    ownerId: user._id,
    onboardingCompleted: true,
  });

  try {
    await Location.create({
      businessId: business._id,
      name: 'Main',
      type: 'STORE',
      isDefault: true,
    });
    await User.updateOne({ _id: user._id }, { businessId: business._id, role: ROLES.OWNER });
  } catch (err) {
    // Compensate: onboarding must not leave half-created tenants behind.
    await Location.deleteMany({ businessId: business._id });
    await Business.deleteOne({ _id: business._id });
    throw err;
  }

  return business;
}

async function getBusiness(businessId) {
  const business = await Business.findById(businessId);
  if (!business) throw ApiError.notFound('Business not found');
  return business;
}

async function updateBusiness(businessId, updates) {
  const business = await Business.findOneAndUpdate({ _id: businessId }, updates, {
    new: true,
    runValidators: true,
  });
  if (!business) throw ApiError.notFound('Business not found');
  return business;
}

async function listLocations(businessId) {
  return Location.find({ businessId, active: true }).sort({ isDefault: -1, name: 1 });
}

async function getDefaultLocation(businessId) {
  return Location.findOne({ businessId, isDefault: true });
}

module.exports = {
  createBusiness, getBusiness, updateBusiness, listLocations, getDefaultLocation,
};