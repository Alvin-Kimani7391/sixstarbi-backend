const businessService = require('../../business.service');
const ApiError = require('../../../utils/ApiError');
const { IMPORT_LIMITS } = require('../../../constants');

const DAY = 86400000;
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const field = (key, label, type, aliases, opts = {}) => ({ key, label, type, aliases, ...opts });

class Tally {
  constructor() {
    this.totals = { processed: 0, valid: 0, corrected: 0, duplicates: 0, incomplete: 0 };
    this.issues = [];
    this.issueCount = 0;
    this.ambiguousDates = 0;
  }
  issue(row, fieldName, severity, message) {
    this.issueCount += 1;
    if (this.issues.length < IMPORT_LIMITS.MAX_STORED_ISSUES) this.issues.push({ row, field: fieldName, severity, message });
  }
  begin() { this.totals.processed += 1; }
  ok(corrected) { if (corrected) this.totals.corrected += 1; else this.totals.valid += 1; }
  reject() { this.totals.incomplete += 1; }
  rejectWith(row, fieldName, message) { this.reject(); this.issue(row, fieldName, 'HIGH', message); }
  duplicate(row, fieldName, message) { this.totals.duplicates += 1; this.issue(row, fieldName, 'LOW', message); }
}

/** Finds a product by SKU or barcode first, then by name. */
function buildResolver(products) {
  const bySku = new Map(), byBarcode = new Map(), byName = new Map();
  for (const p of products) {
    if (p.sku) bySku.set(norm(p.sku), p);
    if (p.barcode) byBarcode.set(norm(p.barcode), p);
    const n = norm(p.name);
    if (!byName.has(n)) byName.set(n, p);
  }
  return {
    find(sku, name) {
      if (sku) {
        const k = norm(sku);
        const hit = bySku.get(k) || byBarcode.get(k);
        if (hit) return hit;
      }
      return name ? byName.get(norm(name)) || null : null;
    },
  };
}

async function loadLocations(businessId) {
  const locs = await businessService.listLocations(businessId);
  if (!locs.length) throw ApiError.badRequest('Your business has no active location', 'LOCATION_NOT_FOUND');
  const byName = new Map(locs.map((l) => [norm(l.name), l._id]));
  return { def: (locs.find((l) => l.isDefault) || locs[0])._id, find: (n) => byName.get(norm(n)) || null };
}

function pickLocation(locs, name, rowNo, tally) {
  if (!name) return { locationId: locs.def, corrected: false };
  const id = locs.find(name);
  if (id) return { locationId: id, corrected: false };
  tally.issue(rowNo, 'Location', 'LOW', `Location "${name}" was not found. The main location was used.`);
  return { locationId: locs.def, corrected: true };
}

function span(dates) {
  if (!dates.length) return { from: null, to: null, days: 0 };
  const t = dates.map((d) => d.getTime());
  const from = new Date(Math.min(...t)), to = new Date(Math.max(...t));
  return { from, to, days: Math.floor((to - from) / DAY) + 1 };
}

module.exports = { Tally, field, norm, r2, buildResolver, loadLocations, pickLocation, span };