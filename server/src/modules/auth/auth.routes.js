import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requestPasswordReset, resetPassword } from './password-reset.service.js';
import { Organization } from '../users/user.model.js';
import { run, validate } from '../../utils/http.js';
import { requireAuth, safeUser } from '../../middleware/authenticate.js';
import { loginSchema, registerSchema, profileSchema } from './auth.schemas.js';
import { loginAccount, registerAccount } from './auth.service.js';

const router = Router();
const recoveryLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many password recovery attempts. Please try again in an hour.' } });
router.post('/forgot-password', recoveryLimit, run(async (req, res) => {
  const { email } = validate(z.object({ email: z.string().trim().toLowerCase().email().max(200) }), req.body);
  res.json(await requestPasswordReset(email));
}));
router.post('/reset-password', recoveryLimit, run(async (req, res) => {
  const data = validate(z.object({ token: z.string().regex(/^[a-f\d]{64}$/i), password: z.string().min(10).max(128) }), req.body);
  res.json(await resetPassword(data));
}));
router.post('/register', run(async (req, res) => {
  res.status(201).json(await registerAccount(validate(registerSchema, req.body)));
}));
router.post('/login', run(async (req, res) => {
  res.json(await loginAccount(validate(loginSchema, req.body)));
}));
router.get('/me', requireAuth, run(async (req, res) => {
  const organization = await Organization.findOne({ owner: req.user.id }).lean();
  res.json({ user: safeUser(req.user), organization });
}));
router.patch('/me', requireAuth, run(async (req, res) => {
  Object.assign(req.user, validate(profileSchema, req.body));
  await req.user.save();
  res.json({ user: safeUser(req.user) });
}));
export default router;
