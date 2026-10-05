const router = require('express').Router();
const ctrl = require('../../controllers/purchase.controller');
const validate = require('../../middleware/validate.middleware');
const { protect, authorize, requireBusiness } = require('../../middleware/auth.middleware');
const v = require('../../validators/stock.validator');
const { ROLES: R } = require('../../constants');

const canBuy = authorize(R.OWNER, R.MANAGER, R.ACCOUNTANT, R.ADMIN);

router.use(protect, requireBusiness);

router.get('/', validate({ query: v.listPage }), ctrl.list);
router.post('/', canBuy, validate({ body: v.purchase }), ctrl.create);
router.get('/:id', validate({ params: v.idParam }), ctrl.get);
router.post('/:id/receive', canBuy, validate({ params: v.idParam }), ctrl.receive);

module.exports = router;