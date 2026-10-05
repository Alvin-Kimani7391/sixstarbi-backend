const env = require('../../config/env');
const logger = require('../../config/logger');

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 30000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class GeminiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = status;
  }
}

const isConfigured = () => Boolean(env.GEMINI_API_KEY);
const cleanModel = (m) => String(m || '').replace(/^models\//, '');
let activeModel = null;

function classify(status, data) {
  const msg = (data && data.error && data.error.message) || `HTTP ${status}`;
  if (/location is not supported/i.test(msg)) return new GeminiError('REGION', msg, status);
  if ((status === 400 && /api key/i.test(msg)) || status === 401 || status === 403) return new GeminiError('BAD_KEY', msg, status);
  if (status === 404) return new GeminiError('MODEL_NOT_FOUND', msg, status);
  if (status === 429) return new GeminiError('QUOTA', msg, status);
  if (status >= 500) return new GeminiError('OVERLOADED', msg, status);
  return new GeminiError('REQUEST_FAILED', msg, status);
}

// Plain-language reasons that are safe to show the user (never contains the key).
const REASONS = {
  NOT_CONFIGURED: 'The Gemini API key is not set on the server (GEMINI_API_KEY).',
  BAD_KEY: 'Google rejected the Gemini API key. Create a new key in Google AI Studio and update GEMINI_API_KEY.',
  REGION: 'The Gemini API is not available from the server\'s location.',
  MODEL_NOT_FOUND: 'The configured Gemini model does not exist. Check GEMINI_MODEL.',
  QUOTA: 'The Gemini usage limit was reached. Wait a minute and try again, or check your plan in Google AI Studio.',
  OVERLOADED: 'Google\'s Gemini service is busy right now. Try again shortly.',
  TIMEOUT: 'Gemini took too long to respond.',
  NETWORK: 'The server could not reach Google. Check its internet connection.',
  BLOCKED: 'Gemini declined to answer this request.',
  EMPTY: 'Gemini returned an empty answer.',
};
const describe = (err) => ({
  code: (err && err.code) || 'UNKNOWN',
  message: REASONS[err && err.code] || 'The AI service returned an unexpected error.',
});

async function call(path, { method = 'GET', body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      signal: ctrl.signal,
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new GeminiError('TIMEOUT', 'Gemini request timed out');
    throw new GeminiError('NETWORK', `Could not reach Google: ${(err.cause && err.cause.code) || err.message}`);
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) throw classify(res.status, data);
  return data;
}

async function generateOnce(model, prompt, { system, temperature = 0.3, maxOutputTokens = 4096 } = {}) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const data = await call(`/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', body });
  if (data.promptFeedback && data.promptFeedback.blockReason) {
    throw new GeminiError('BLOCKED', `Blocked: ${data.promptFeedback.blockReason}`);
  }
  const cand = data.candidates && data.candidates[0];
  const text = cand && cand.content && cand.content.parts ? cand.content.parts.map((p) => p.text || '').join('').trim() : '';
  if (!text) throw new GeminiError('EMPTY', `No text returned (finish reason: ${(cand && cand.finishReason) || 'unknown'})`);
  return text;
}

async function discoverModel() {
  const data = await call('/models?pageSize=100');
  const bad = /(image|tts|live|audio|embed|robotics|computer|exp|preview|vision|learnlm|gemma)/i;
  const names = (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => cleanModel(m.name));
  const flash = names.filter((n) => /flash/.test(n) && !bad.test(n)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return flash[0] || names.find((n) => !bad.test(n)) || null;
}

async function attempt(model, prompt, opts) {
  try {
    return await generateOnce(model, prompt, opts);
  } catch (err) {
    if (err.code === 'OVERLOADED' || err.code === 'TIMEOUT') {
      await sleep(1500);
      return generateOnce(model, prompt, opts); // one retry for temporary problems
    }
    throw err;
  }
}

async function generate(prompt, opts) {
  if (!isConfigured()) throw new GeminiError('NOT_CONFIGURED', 'GEMINI_API_KEY is not set');
  const model = activeModel || cleanModel(env.GEMINI_MODEL);
  try {
    const text = await attempt(model, prompt, opts);
    activeModel = model;
    return text;
  } catch (err) {
    if (err.code !== 'MODEL_NOT_FOUND') throw err;
    const found = await discoverModel();
    if (!found || found === model) throw err;
    logger.warn(`Gemini model "${model}" was not found. Using "${found}". Set GEMINI_MODEL=${found} in .env to make this permanent.`);
    const text = await attempt(found, prompt, opts);
    activeModel = found;
    return text;
  }
}

/** Live connection test used by Settings. Never returns the key. */
async function status() {
  const out = {
    configured: isConfigured(), keyLength: env.GEMINI_API_KEY.length,
    model: activeModel || cleanModel(env.GEMINI_MODEL), ok: false, error: null, latencyMs: null,
  };
  if (!out.configured) {
    out.error = { ...describe({ code: 'NOT_CONFIGURED' }), detail: 'GEMINI_API_KEY is empty' };
    return out;
  }
  const t0 = Date.now();
  try {
    await generate('Reply with the single word: OK', { maxOutputTokens: 1024 });
    out.ok = true;
    out.model = activeModel || out.model;
  } catch (err) {
    out.error = { ...describe(err), detail: err.message };
  }
  out.latencyMs = Date.now() - t0;
  return out;
}

module.exports = { generate, status, describe, isConfigured, GeminiError };