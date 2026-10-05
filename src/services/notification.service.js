const env = require('../config/env');
const logger = require('../config/logger');
const brevo = require('../integrations/brevo/brevo.client');

async function safeSend(payload) {
  try {
    return await brevo.sendEmail(payload);
  } catch (err) {
    logger.error(`Notification failed: ${err.message}`);
    return { failed: true };
  }
}

const wrap = (title, body) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
    <h2>${title}</h2>${body}
    <p style="color:#888;font-size:12px">Six Star Intelligence — From business data to business decisions.</p>
  </div>`;

async function sendVerificationEmail(user, token) {
  const link = `${env.APP_URL}/#/verify-email?token=${token}`; 
  return safeSend({
    to: user.email,
    subject: 'Verify your Six Star Intelligence account',
    html: wrap('Verify your email', `<p>Hi ${user.name},</p><p><a href="${link}">Verify my email</a></p>`),
  });
}

async function sendPasswordResetEmail(user, token) {
  const link = `${env.APP_URL}/#/reset-password?token=${token}`;
  return safeSend({
    to: user.email,
    subject: 'Reset your Six Star Intelligence password',
    html: wrap(
      'Reset your password',
      `<p>Hi ${user.name},</p><p><a href="${link}">Choose a new password</a>. This link expires in 1 hour.</p>`
    ),
  });
}

async function sendImportCompleted(user, summary) {
  return safeSend({
    to: user.email,
    subject: 'Your data import is complete',
    html: wrap(
      'Import complete',
      `<p>Data quality score: <b>${summary.qualityScore}/100</b></p><p>${summary.processed} records processed.</p>`
    ),
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendImportCompleted };