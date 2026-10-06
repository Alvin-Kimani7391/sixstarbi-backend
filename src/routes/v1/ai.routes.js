const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../../controllers/ai.controller');
const validate = require('../../middleware/validate.middleware');
const { protect, authorize, requireBusiness } = require('../../middleware/auth.middleware');
const v = require('../../validators/ai.validator');
const { ROLES: R } = require('../../constants');

const limiter = rateLimit({
  windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Wait a minute.' } },
});

router.use(protect, requireBusiness);

router.get('/status', authorize(R.OWNER, R.MANAGER, R.ADMIN), limiter, ctrl.status);
router.get('/conversations', ctrl.conversations);
router.get('/welcome', ctrl.welcome);
router.post('/ask', limiter, validate({ body: v.ask }), ctrl.ask);
router.post('/explain', limiter, validate({ body: v.explain }), ctrl.explain);
router.post('/summarize', limiter, validate({ body: v.summarize }), ctrl.summarize);
router.post('/business-plan', limiter, validate({ body: v.businessPlan }), ctrl.businessPlan);

module.exports = router;