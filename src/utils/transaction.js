const mongoose = require('mongoose');
const env = require('../config/env');
const logger = require('../config/logger');

let supported = null; // null = unknown, true/false once detected

const isUnsupported = (err) =>
  err && (err.code === 20 || /replica set|Transaction numbers are only allowed/i.test(err.message || ''));

/**
 * Runs work(session) inside a MongoDB transaction.
 * Development on a standalone MongoDB runs without a transaction and logs a warning.
 * Production never falls back.
 */
async function runInTransaction(work) {
  if (supported === false) return work(null);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    supported = true;
    return result;
  } catch (err) {
    if (isUnsupported(err) && !env.isProd) {
      supported = false;
      logger.warn('MongoDB transactions are unavailable (standalone server). Running WITHOUT transactions. Use a replica set or Atlas.');
      return work(null);
    }
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { runInTransaction };