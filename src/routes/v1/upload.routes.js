const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../../controllers/upload.controller');
const validate = require('../../middleware/validate.middleware');
const { single } = require('../../middleware/upload.middleware');
const { protect, authorize, requireBusiness } = require('../../middleware/auth.middleware');
const v = require('../../validators/upload.validator');
const { ROLES: R } = require('../../constants');

const limiter = rateLimit({
  windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many uploads. Wait a minute.' } },
});
const canEdit = authorize(R.OWNER, R.MANAGER, R.ADMIN);

router.use(protect, requireBusiness);

router.post('/', canEdit, limiter, single, validate({ body: v.upload }), ctrl.create);
router.delete('/:id', canEdit, validate({ params: v.idParam }), ctrl.remove);

module.exports = router;