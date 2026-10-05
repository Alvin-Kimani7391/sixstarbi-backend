const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../../controllers/import.controller');
const validate = require('../../middleware/validate.middleware');
const { single } = require('../../middleware/upload.middleware');
const { protect, authorize, requireBusiness } = require('../../middleware/auth.middleware');
const v = require('../../validators/import.validator');
const { ROLES: R } = require('../../constants');

const limiter = rateLimit({
  windowMs: 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many imports. Wait a minute.' } },
});
const canImport = authorize(R.OWNER, R.MANAGER, R.ADMIN);

router.use(protect, requireBusiness);

router.get('/', validate({ query: v.list }), ctrl.list);
router.post('/:type/preview', canImport, limiter, single, validate({ params: v.typeParam }), ctrl.preview);
router.post('/:id/process', canImport, validate({ params: v.idParam, body: v.process }), ctrl.process);
router.get('/:id', validate({ params: v.idParam }), ctrl.get);

module.exports = router;