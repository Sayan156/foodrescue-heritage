import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { fail } from '../utils/http.js';

export function createRazorpayClient() {
  const { RAZORPAY_KEY_ID: key_id, RAZORPAY_KEY_SECRET: key_secret } = process.env;
  if (!key_id || !key_secret) throw fail(503, 'Payment gateway not configured. Use test credentials.');
  return new Razorpay({ key_id, key_secret });
}

export function createHmacSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeSignatureCompare(actual, expected) {
  return typeof actual === 'string'
    && typeof expected === 'string'
    && actual.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
