const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Order matters: the first match wins.
const RULES = [
  ['STOP_BUYING', /stop (buying|ordering|stocking|selling)|do not buy|dont buy|not to buy/],
  ['DEAD_STOCK', /dead stock|slow moving|not selling|no sales|stuck stock/],
  ['OVERSTOCK', /overstock|too much stock|excess stock|too many/],
  ['ORDER_QTY', /how (much|many).*(order|buy|reorder|restock)/],
  ['WHEN_ORDER', /when.*(order|reorder|buy|restock|run out)|run out/],
  ['WHAT_TODAY', /what should i do|what needs my attention|briefing|priorit|how is my business/],
  ['WHAT_TO_BUY', /(what|which).*(order|buy|restock|reorder|purchase)|low stock|need.*restock/],
  ['PROFIT_WHY', /why.*(profit|margin)|(profit|margin).*(fall|fell|drop|declin|decreas|down|lower)/],
  ['TOP_PROFIT', /(most|highest|best|top).*(profit|margin|earn)|profitable/],
  ['SALES', /sales|revenue|selling best|best sell|top sell|performance|growth/],
  ['SUPPLIER', /supplier|vendor/],
  ['TOOLS', /break ?even|payoff|maximax|maximin|decision tree|expected value|regret/],
];

function detect(question, productRows = []) {
  const q = ` ${norm(question)} `;
  let intent = 'GENERAL';
  for (const [name, re] of RULES) {
    if (re.test(q)) { intent = name; break; }
  }
  // A named product narrows the question to that product.
  const product = [...productRows]
    .sort((a, b) => b.name.length - a.name.length)
    .find((p) => norm(p.name).length >= 3 && q.includes(` ${norm(p.name)} `)) || null;
  if (product && intent !== 'TOOLS' && !['ORDER_QTY', 'WHEN_ORDER'].includes(intent)) intent = 'PRODUCT';
  return { intent, product };
}

module.exports = { detect };