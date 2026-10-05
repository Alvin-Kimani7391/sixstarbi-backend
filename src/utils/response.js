const ok = (res, data = {}, status = 200, meta) => {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
};

const created = (res, data = {}) => ok(res, data, 201);

module.exports = { ok, created };