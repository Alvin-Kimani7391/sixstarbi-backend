const router = require('express').Router();
const ctrl = require('../../controllers/business.controller');
const validate = require('../../middleware/validate.middleware');
const { protect, authorize, requireBusiness } = require('../../middleware/auth.middleware');
const v = require('../../validators/business.validator');
const { ROLES } = require('../../constants');

router.use(protect);

router.post('/', validate({ body: v.createBusiness }), ctrl.create);

router.get('/', requireBusiness, ctrl.get);
router.put(
  '/',
  requireBusiness,
  authorize(ROLES.OWNER, ROLES.MANAGER, ROLES.ADMIN),
  validate({ body: v.updateBusiness }),
  ctrl.update
);
router.get('/locations', requireBusiness, ctrl.locations);

module.exports = router;