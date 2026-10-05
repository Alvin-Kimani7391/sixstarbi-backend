const meta = (page, limit, total) => ({
  page, limit, total, pages: Math.max(1, Math.ceil(total / limit)),
});

module.exports = { meta, skip: (page, limit) => (page - 1) * limit };