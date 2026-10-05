const router = require('express').Router();
const ctrl = require('../../controllers/inventory.controller');
const validate = require('../../middleware/validate.middleware');
const { protect, authorize, requireBusiness } = require('../../middleware/auth.middleware');
const v = require('../../validators/stock.validator');
const { ROLES: R } = require('../../constants');

router.use(protect, requireBusiness);

router.get('/', ctrl.stock);
router.get('/transactions', validate({ query: v.listTransactions }), ctrl.transactions);
router.post('/adjust', authorize(R.OWNER, R.MANAGER, R.ADMIN), validate({ body: v.adjust }), ctrl.adjust);

module.exports = router;