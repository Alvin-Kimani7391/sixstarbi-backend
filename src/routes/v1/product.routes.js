const router = require('express').Router();
const ctrl = require('../../controllers/product.controller');
const validate = require('../../middleware/validate.middleware');
const { protect, authorize, requireBusiness } = require('../../middleware/auth.middleware');
const v = require('../../validators/product.validator');
const { ROLES: R } = require('../../constants');

const canEdit = authorize(R.OWNER, R.MANAGER, R.ADMIN);

router.use(protect, requireBusiness);

router.get('/', validate({ query: v.list }), ctrl.list);
router.post('/', canEdit, validate({ body: v.create }), ctrl.create);
router.get('/:id', validate({ params: v.idParam }), ctrl.get);
router.put('/:id', canEdit, validate({ params: v.idParam, body: v.update }), ctrl.update);
router.delete('/:id', canEdit, validate({ params: v.idParam }), ctrl.remove);

module.exports = router;