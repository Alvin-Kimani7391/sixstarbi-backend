const crypto = require('crypto');
const env = require('../../config/env');
const logger = require('../../config/logger');

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 30000;
const CACHE_MS = 15 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanModel = (m) => String(m || '').replace(/^models\//, '');
const isConfigured = () => Boolean(env.GEMINI_API_KEY);

class GeminiError extends Error {
  constructor(code, message, status, extra) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = status;
    if (extra) Object.assign(this, extra);
  }
}

// Reads Google's quota details: per-minute or per-day, how long to wait, and whether the limit is 0.
function quotaInfo(data, msg) {
  const details = (data && data.error && data.error.details) || [];
  let retryAfterSec = null;
  let quotaScope = 'unknown';
  for (const d of details) {
    if (d.retryDelay) {
      const m = /([\d.]+)s/.exec(d.retryDelay);
      if (m) retryAfterSec = Math.ceil(Number(m[1]));
    }
    for (const v of d.violations || []) {
      const id = `${v.quotaId || ''} ${v.quotaMetric || ''}`;
      if (/PerDay/i.test(id)) quotaScope = 'day';
      else if (/PerMinute/i.test(id) && quotaScope !== 'day') quotaScope = 'minute';
    }
  }
  if (retryAfterSec == null) {
    const m = /retry in ([\d.]+)s/i.exec(msg);
    if (m) retryAfterSec = Math.ceil(Number(m[1]));
  }
  return { retryAfterSec, quotaScope, zeroLimit: /limit:\s*0\b/.test(msg) };
}

function classify(status, data) {
  const msg = (data && data.error && data.error.message) || `HTTP ${status}`;
  if (/location is not supported/i.test(msg)) return new GeminiError('REGION', msg, status);
  if ((status === 400 && /api key/i.test(msg)) || status === 401 || status === 403) return new GeminiError('BAD_KEY', msg, status);
  if (status === 404) return new GeminiError('MODEL_NOT_FOUND', msg, status);
  if (status === 429) return new GeminiError('QUOTA', msg, status, quotaInfo(data, msg));
  if (status >= 500) return new GeminiError('OVERLOADED', msg, status);
  return new GeminiError('REQUEST_FAILED', msg, status);
}

const REASONS = {
  NOT_CONFIGURED: 'The Gemini API key is not set on the server (GEMINI_API_KEY).',
  BAD_KEY: 'Google rejected the Gemini API key. Create a new key in Google AI Studio and update GEMINI_API_KEY.',
  REGION: "The Gemini API is not available from the server's location.",
  MODEL_NOT_FOUND: 'The configured Gemini model does not exist. Check GEMINI_MODEL.',
  QUOTA: 'The Gemini usage limit was reached. Wait a minute and try again, or check your plan in Google AI Studio.',
  OVERLOADED: "Google's Gemini service is busy right now. Try again shortly.",
  TIMEOUT: 'Gemini took too long to respond.',
  NETWORK: 'The server could not reach Google. Check its internet connection.',
  BLOCKED: 'Gemini declined to answer this request.',
  EMPTY: 'Gemini returned an empty answer.',
};

function describe(err) {
  const code = (err && err.code) || 'UNKNOWN';
  if (code === 'QUOTA') {
    if (err.zeroLimit) {
      return { code, message: 'Google reports a usage limit of 0 for this key and model, so the free tier is not available for it. Set GEMINI_MODEL=gemini-2.5-flash-lite, create a new key in a new Google AI Studio project, or enable billing.' };
    }
    if (err.quotaScope === 'day') {
      return { code, message: 'The daily Gemini limit for this key is used up. It resets daily. Use a different key, enable billing, or try again later.' };
    }
    if (err.quotaScope === 'minute') {
      return { code, message: `Too many Gemini requests in a minute. Wait about ${err.retryAfterSec || 30} seconds and try again.` };
    }
  }
  return { code, message: REASONS[code] || 'The AI service returned an unexpected error.' };
}

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

async function generateOnce(model, prompt, { system, temperature = 0.4, maxOutputTokens = 4096 } = {}) {
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

// One quick retry for temporary problems, and for short per-minute limits.
async function attempt(model, prompt, opts) {
  try {
    return await generateOnce(model, prompt, opts);
  } catch (err) {
    if (err.code === 'OVERLOADED' || err.code === 'TIMEOUT') {
      await sleep(1500);
      return generateOnce(model, prompt, opts);
    }
    if (err.code === 'QUOTA' && err.quotaScope !== 'day' && !err.zeroLimit && err.retryAfterSec && err.retryAfterSec <= 15) {
      await sleep((err.retryAfterSec + 1) * 1000);
      return generateOnce(model, prompt, opts);
    }
    throw err;
  }
}

let flash = { at: 0, list: [] };
async function flashModels() {
  if (flash.list.length && Date.now() - flash.at < 3600e3) return flash.list;
  const data = await call('/models?pageSize=100');
  const bad = /(image|tts|live|audio|embed|robotics|computer|exp|preview|vision|learnlm|gemma|thinking)/i;
  const list = (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => cleanModel(m.name))
    .filter((n) => /flash/.test(n) && !bad.test(n))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    .slice(0, 4);
  flash = { at: Date.now(), list };
  return list;
}

const cache = new Map();
const cooling = new Map(); // model -> { until, err }
let activeModel = null;
let lastTried = [];

async function generate(prompt, opts = {}) {
  if (!isConfigured()) throw new GeminiError('NOT_CONFIGURED', 'GEMINI_API_KEY is not set');

  const key = crypto.createHash('sha1').update(`${opts.system || ''}\n${prompt}`).digest('hex');
  const hit = cache.get(key);
  if (!opts.noCache && hit && hit.exp > Date.now()) return hit.text;

  const queue = [activeModel || cleanModel(env.GEMINI_MODEL)];
  const tried = [];
  let expanded = false;
  let lastErr = null;

  while (queue.length) {
    const model = queue.shift();
    if (tried.includes(model)) continue;
    tried.push(model);

    const cool = cooling.get(model);
    if (cool && cool.until > Date.now()) { lastErr = lastErr || cool.err; continue; }

    try {
      const text = await attempt(model, prompt, opts);
      activeModel = model;
      lastTried = tried;
      if (!opts.noCache) {
        if (cache.size > 200) cache.delete(cache.keys().next().value);
        cache.set(key, { text, exp: Date.now() + CACHE_MS });
      }
      return text;
    } catch (err) {
      lastErr = err;
      if (err.code === 'QUOTA') {
        const wait = err.zeroLimit || err.quotaScope === 'day' ? 3600 : Math.min(err.retryAfterSec || 60, 120);
        cooling.set(model, { until: Date.now() + wait * 1000, err });
      }
      if (!['QUOTA', 'MODEL_NOT_FOUND', 'OVERLOADED'].includes(err.code)) throw err;
      if (!expanded) {
        expanded = true;
        const more = await flashModels().catch(() => []);
        queue.push(...more);
      }
    }
  }
  lastTried = tried;
  if (lastErr && lastErr.code === 'MODEL_NOT_FOUND') logger.warn(`No working Gemini model found. Tried: ${tried.join(', ')}`);
  throw lastErr;
}

/** Live connection test for Settings. Never returns the key. */
async function status() {
  const out = {
    configured: isConfigured(), keyLength: env.GEMINI_API_KEY.length,
    model: activeModel || cleanModel(env.GEMINI_MODEL), ok: false, error: null, latencyMs: null, modelsTried: [],
  };
  if (!out.configured) {
    out.error = { ...describe({ code: 'NOT_CONFIGURED' }), detail: 'GEMINI_API_KEY is empty' };
    return out;
  }
  cooling.clear(); // a manual test should really call Google
  const t0 = Date.now();
  try {
    await generate('Reply with the single word: OK', { maxOutputTokens: 1024, noCache: true });
    out.ok = true;
    out.model = activeModel || out.model;
  } catch (err) {
    out.error = { ...describe(err), detail: String(err.message).slice(0, 400) };
    if (err.code === 'QUOTA') out.error.quota = { scope: err.quotaScope, retryAfterSec: err.retryAfterSec, zeroLimit: err.zeroLimit };
  }
  out.modelsTried = lastTried;
  out.latencyMs = Date.now() - t0;
  return out;
}

module.exports = { generate, status, describe, isConfigured, GeminiError };