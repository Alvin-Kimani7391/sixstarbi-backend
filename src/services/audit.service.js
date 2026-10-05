const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

/**
 * Never let audit failures break the main flow.
 */
async function record(req, action, { entityType, entityId, metadata, businessId, userId } = {}) {
  try {
    await AuditLog.create({
      businessId: businessId || req?.businessId || req?.user?.businessId,
      userId: userId || req?.user?._id,
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      metadata,
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (err) {
    logger.warn(`Audit log failed for ${action}: ${err.message}`);
  }
}

module.exports = { record };