const router = require('express').Router();
const ctrl = require('../../controllers/sales.controller');
const validate = require('../../middleware/validate.middleware');
const { protect, authorize, requireBusiness } = require('../../middleware/auth.middleware');
const v = require('../../validators/stock.validator');
const { ROLES: R } = require('../../constants');

router.use(protect, requireBusiness);

router.get('/', validate({ query: v.listSales }), ctrl.list);
router.post('/', authorize(R.OWNER, R.MANAGER, R.STAFF, R.ADMIN), validate({ body: v.sale }), ctrl.create);
router.get('/:id', validate({ params: v.idParam }), ctrl.get);

module.exports = router;