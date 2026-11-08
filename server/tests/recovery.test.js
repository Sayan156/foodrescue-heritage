import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPasswordReset, sendResetEmail } from '../src/modules/auth/password-reset.service.js';

test('password recovery reports missing email configuration before account lookup', async () => {
  const previous = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    await assert.rejects(requestPasswordReset('unknown@example.com'), error => error.status === 503 && /not configured/.test(error.message));
  } finally {
    if (previous === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous;
  }
});

test('reset email adapter sends the intended payload and handles provider outages', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.resend.com/emails');
      const body = JSON.parse(options.body);
      assert.deepEqual(body.to, ['synthetic@example.com']);
      assert.match(body.text, /https:\/\/example.com\/reset-password#token=test/);
      return { ok: true };
    };
    await sendResetEmail({ email: 'synthetic@example.com', url: 'https://example.com/reset-password#token=test' });
    globalThis.fetch = async () => ({ ok: false });
    await assert.rejects(sendResetEmail({ email: 'synthetic@example.com', url: 'https://example.com' }), { status: 503 });
    globalThis.fetch = async () => { throw new Error('Network unavailable'); };
    await assert.rejects(sendResetEmail({ email: 'synthetic@example.com', url: 'https://example.com' }), { status: 503 });
  } finally { globalThis.fetch = original; }
});
