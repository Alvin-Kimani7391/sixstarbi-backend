const router = require('express').Router();

router.get('/health', (_req, res) =>
  res.json({ success: true, data: { service: 'six-star-intelligence', status: 'ok', time: new Date().toISOString() } })
);

router.use('/auth', require('./auth.routes'));
router.use('/business', require('./business.routes'));
router.use('/decisions', require('./decision.routes'));

// Registered in later batches:
// router.use('/products', require('./product.routes'));
// router.use('/sales', require('./sales.routes'));
// router.use('/purchases', require('./purchase.routes'));
// router.use('/inventory', require('./inventory.routes'));
// router.use('/uploads', require('./upload.routes'));
// router.use('/imports', require('./import.routes'));
// router.use('/analytics', require('./analytics.routes'));
// router.use('/recommendations', require('./recommendation.routes'));
// router.use('/alerts', require('./alert.routes'));
// router.use('/ai', require('./ai.routes'));

module.exports = router;