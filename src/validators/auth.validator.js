const { z } = require('zod');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const register = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(7).max(20).optional(),
  password,
  country: z.string().trim().min(2).max(60).default('Kenya'),
  currency: z.string().trim().min(3).max(3).toUpperCase().default('KES'),
});

const login = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const verifyEmail = z.object({ token: z.string().min(10) });
const forgotPassword = z.object({ email: z.string().trim().toLowerCase().email() });
const resetPassword = z.object({ token: z.string().min(10), password });

const updateProfile = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  country: z.string().trim().min(2).max(60).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
});

const changePassword = z.object({ currentPassword: z.string().min(1), newPassword: password });

module.exports = {
  register, login, verifyEmail, forgotPassword, resetPassword, updateProfile, changePassword,
};