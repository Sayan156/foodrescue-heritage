import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { User } from '../users/user.model.js';
import { fail } from '../../utils/http.js';

const digest = token => createHash('sha256').update(token).digest('hex');
export const recoveryMessage = 'If an account uses that email address, a password reset link will arrive shortly. Check your spam folder too.';

export async function sendResetEmail({ email, url }) {
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: 'Reset your FoodRescue password',
        text: `Use this link to reset your FoodRescue password within 30 minutes:\n\n${url}\n\nIf you did not request this, you can ignore this email.` }),
    });
  } catch { throw fail(503, 'Password reset email could not be sent. Please try again later.'); }
  if (!response.ok) throw fail(503, 'Password reset email could not be sent. Please try again later.');
}

export async function requestPasswordReset(email, send = sendResetEmail) {
  if (!process.env.PUBLIC_APP_URL || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw fail(503, 'Password recovery is not configured yet. Please contact the administrator.');
  }
  const origin = new URL(process.env.PUBLIC_APP_URL);
  if (!['http:', 'https:'].includes(origin.protocol) || (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')) throw fail(503, 'Password recovery is not configured correctly.');
  const user = await User.findOne({ email });
  if (!user) return { message: recoveryMessage };
  const token = randomBytes(32).toString('hex');
  const resetTokenHash = digest(token);
  await User.updateOne({ _id: user.id }, { $set: { resetTokenHash, resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
  // A fragment keeps the secret out of server access logs and HTTP referrers.
  const url = new URL('/reset-password', origin);
  url.hash = new URLSearchParams({ token }).toString();
  try { await send({ email: user.email, url: url.toString() }); }
  catch (error) {
    await User.updateOne({ _id: user.id, resetTokenHash }, { $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 } });
    throw error;
  }
  return { message: recoveryMessage };
}

export async function resetPassword({ token, password }) {
  const resetTokenHash = digest(token);
  const filter = { resetTokenHash, resetTokenExpiresAt: { $gt: new Date() } };
  if (!await User.exists(filter)) throw fail(400, 'This reset link is invalid or expired. Request a new link.');
  const passwordHash = await bcrypt.hash(password, 12);
  // Consuming the token and invalidating old sessions must happen together.
  const user = await User.findOneAndUpdate({ ...filter, resetTokenExpiresAt: { $gt: new Date() } }, {
    $set: { passwordHash }, $inc: { tokenVersion: 1 }, $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 },
  });
  if (!user) throw fail(400, 'This reset link is invalid or expired. Request a new link.');
  return { message: 'Your password has been reset. Sign in with your new password.' };
}
