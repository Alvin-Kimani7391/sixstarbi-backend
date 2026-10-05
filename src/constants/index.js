const ROLES = Object.freeze({
  OWNER: 'OWNER', MANAGER: 'MANAGER', STAFF: 'STAFF', ACCOUNTANT: 'ACCOUNTANT', ADMIN: 'ADMIN',
});

const DATA_SOURCE_TYPES = Object.freeze([
  'MANUAL', 'CSV', 'EXCEL', 'SIX_STAR_POS', 'SIX_STAR_SUPPLIERS', 'EXTERNAL_POS', 'API', 'IMPORT',
]);

const DATA_PREFERENCES = Object.freeze(['HAVE_DATA', 'MANUAL_ENTRY', 'CONNECT_POS_LATER']);

const RECOMMENDATION_ACTIONS = Object.freeze([
  'ORDER', 'REORDER', 'DO_NOT_BUY', 'STOP_BUYING', 'DISCOUNT', 'REPRICE',
  'TRANSFER', 'INVEST', 'SAVE_CASH', 'PROMOTE', 'CLEAR_STOCK', 'FIND_SUPPLIER',
  'EXPAND', 'WAIT', 'REDUCE_STOCK',
]);

const INVENTORY_TX_TYPES = Object.freeze(['PURCHASE', 'SALE', 'RETURN', 'TRANSFER', 'ADJUSTMENT', 'DAMAGE']);
const PAYMENT_METHODS = Object.freeze(['CASH', 'MPESA', 'CARD', 'BANK', 'CREDIT', 'OTHER']);

// Tunable business rules. Used by the stock status now, and by recommendations in Batch 4.
const INVENTORY_DEFAULTS = Object.freeze({
  LEAD_TIME_DAYS: 7,       // used only when a product has no supplier lead time
  DEMAND_WINDOW_DAYS: 30,  // window for average daily sales
  OVERSTOCK_DAYS: 90,      // more than this many days of cover = overstock
  DEAD_STOCK_DAYS: 45,     // no sale for this long (with stock on hand) = dead stock
});

const IMPORT_TYPES = Object.freeze(['products', 'sales', 'purchases', 'inventory']);
const UPLOAD_FOLDERS = Object.freeze(['products', 'imports', 'documents', 'logos', 'reports']);
const IMPORT_LIMITS = Object.freeze({
  MAX_FILE_BYTES: 10 * 1024 * 1024,
  MAX_ROWS: 50000,
  MAX_STORED_ISSUES: 500, // the true count is kept in issueCount
  CHUNK: 1000,
});

module.exports = {
  ROLES, DATA_SOURCE_TYPES, DATA_PREFERENCES, RECOMMENDATION_ACTIONS,
  INVENTORY_TX_TYPES, PAYMENT_METHODS, INVENTORY_DEFAULTS,
  IMPORT_TYPES, UPLOAD_FOLDERS, IMPORT_LIMITS,
};