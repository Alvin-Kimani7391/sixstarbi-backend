const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../../controllers/auth.controller');
const validate = require('../../middleware/validate.middleware');
const { protect } = require('../../middleware/auth.middleware');
const v = require('../../validators/auth.validator');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } },
});

router.post('/register', authLimiter, validate({ body: v.register }), ctrl.register);
router.post('/login', authLimiter, validate({ body: v.login }), ctrl.login);
router.post('/logout', protect, ctrl.logout);
router.get('/me', protect, ctrl.me);

router.post('/verify-email', validate({ body: v.verifyEmail }), ctrl.verifyEmail);
router.post('/resend-verification', protect, ctrl.resendVerification);
router.post('/forgot-password', authLimiter, validate({ body: v.forgotPassword }), ctrl.forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: v.resetPassword }), ctrl.resetPassword);

router.put('/profile', protect, validate({ body: v.updateProfile }), ctrl.updateProfile);
router.put('/password', protect, validate({ body: v.changePassword }), ctrl.changePassword);

module.exports = router;