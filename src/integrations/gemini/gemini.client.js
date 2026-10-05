const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../../config/env');

const TIMEOUT_MS = 20000;

function isConfigured() {
  return Boolean(env.GEMINI_API_KEY);
}

async function generate(prompt) {
  if (!isConfigured()) throw new Error('Gemini is not configured');
  const model = new GoogleGenerativeAI(env.GEMINI_API_KEY).getGenerativeModel({ model: env.GEMINI_MODEL });
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini timed out')), TIMEOUT_MS));
  const result = await Promise.race([model.generateContent(prompt), timeout]);
  const text = result.response.text();
  if (!text) throw new Error('Gemini returned an empty response');
  return text;
}

module.exports = { generate, isConfigured };