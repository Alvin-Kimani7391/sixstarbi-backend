const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../../controllers/decision.controller');
const validate = require('../../middleware/validate.middleware');
const { protect, requireBusiness } = require('../../middleware/auth.middleware');
const v = require('../../validators/decision.validator');

// Gemini calls cost money: limit explanations per user session window.
const explainLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many explanations. Wait a minute.' } },
});

router.use(protect, requireBusiness);

router.post('/preview', validate({ body: v.problem }), ctrl.preview);
router.post('/', validate({ body: v.problem }), ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', validate({ params: v.idParam }), ctrl.get);
router.post('/:id/explain', explainLimiter, validate({ params: v.idParam }), ctrl.explain);
router.post('/break-even', validate({ body: v.breakEven }), ctrl.createBreakEven);
router.post('/tree', validate({ body: v.tree }), ctrl.createTree);
router.delete('/:id', validate({ params: v.idParam }), ctrl.remove);

module.exports = router; 