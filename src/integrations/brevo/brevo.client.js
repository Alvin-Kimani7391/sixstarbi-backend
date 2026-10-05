const env = require('../../config/env');
const logger = require('../../config/logger');

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

function isConfigured() {
  return Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL);
}

async function sendEmail({ to, subject, html }) {
  if (!isConfigured()) {
    logger.warn(`[brevo] Not configured. Email to ${to} skipped. Subject: ${subject}`);
    return { skipped: true };
  }

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo error ${res.status}: ${text}`);
  }
  return res.json();
}

module.exports = { sendEmail, isConfigured };