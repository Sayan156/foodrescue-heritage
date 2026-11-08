
import { Router } from 'express';
import {
  createRazorpayClient,
  createHmacSignature,
  safeSignatureCompare
} from '../../config/razorpay.js';
import { z } from 'zod';
import { Payment, PaymentEvent } from './payment.model.js';
import { run, fail, validate } from '../../utils/http.js';
import { requireAuth } from '../../middleware/authenticate.js';

const router = Router();

const hmac = createHmacSignature;
const equal = safeSignatureCompare;
const gateway = createRazorpayClient;

// Mark a payment as paid.
// Also used by the Razorpay webhook, which authenticates through
// its webhook signature rather than a user JWT.
async function markPaid(orderId, paymentId) {
  const p = await Payment.findOne({ orderId });

  if (!p) return null;

  if (p.paymentId && p.paymentId !== paymentId) {
    throw fail(409, 'Payment mismatch');
  }

  if (p.status !== 'paid') {
    p.paymentId = paymentId;
    p.status = 'paid';
    p.confirmedAt = new Date();
    await p.save();
  }

  return p;
}

// Public endpoint: exposes only the Razorpay public key.
router.get('/config', (req, res) => {
  res.json({
    enabled: !!(
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET
    ),
    keyId: process.env.RAZORPAY_KEY_ID || null
  });
});

// Create payment order.
// JWT authentication required.
router.post('/create-order', requireAuth, run(async (req, res) => {
  const data = validate(
    z.object({
      amountRupees: z.coerce.number().int().min(1).max(100000),
      sponsorName: z.string().trim().min(2).max(100),
      sponsorEmail: z.string().email(),
      purpose: z.enum(['general', 'logistics']).default('general')
    }),
    req.body
  );

  const amountPaise = data.amountRupees * 100;

  const order = await gateway().orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: `FR${Date.now()}`.slice(0, 40),
    notes: {
      purpose: data.purpose
    }
  });

  // Associate payment with the authenticated user.
  const p = await Payment.create({
    sponsor: req.user.id,
    orderId: order.id,
    amountPaise,
    purpose: data.purpose,
    sponsorName: data.sponsorName,
    sponsorEmail: data.sponsorEmail
  });

  res.status(201).json({
    orderId: order.id,
    amount: amountPaise,
    currency: 'INR',
    keyId: process.env.RAZORPAY_KEY_ID,
    paymentRecordId: p.id
  });
}));

// Verify payment.
// JWT authentication and order ownership required.
router.post('/verify', requireAuth, run(async (req, res) => {
  const {
    orderId,
    paymentId,
    signature
  } = validate(
    z.object({
      orderId: z.string().min(5),
      paymentId: z.string().min(5),
      signature: z.string().length(64)
    }),
    req.body
  );

  // Ensure the order belongs to the authenticated user.
  const p = await Payment.findOne({
    orderId,
    sponsor: req.user.id
  });

  if (!p) {
    throw fail(404, 'Payment order not found');
  }

  // Verify Razorpay payment signature.
  const expectedSignature = hmac(
    `${p.orderId}|${paymentId}`,
    process.env.RAZORPAY_KEY_SECRET || ''
  );

  if (!equal(expectedSignature, signature)) {
    throw fail(400, 'Invalid payment signature');
  }

  // Fetch payment directly from Razorpay.
  const remote = await gateway().payments.fetch(paymentId);

  if (
    remote.order_id !== orderId ||
    remote.amount !== p.amountPaise ||
    remote.currency !== 'INR'
  ) {
    throw fail(400, 'Payment details mismatch');
  }

  if (remote.status === 'captured') {
    await markPaid(orderId, paymentId);

    return res.json({
      status: 'paid'
    });
  }

  res.json({
    status: remote.status === 'authorized'
      ? 'authorized'
      : 'pending'
  });
}));

// Retrieve only the authenticated user's payment history.
router.get('/mine', requireAuth, run(async (req, res) => {
  const items = await Payment.find({
    sponsor: req.user.id
  })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ items });
}));

// Razorpay webhook.
// Registered with express.raw BEFORE express.json in app.js.
// Webhook authentication uses Razorpay's signature, not JWT.
export const webhook = run(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    throw fail(503, 'Webhook not configured');
  }

  const signature = req.headers['x-razorpay-signature'];

  if (!equal(hmac(req.body, secret), signature)) {
    throw fail(400, 'Invalid webhook signature');
  }

  const event = JSON.parse(req.body.toString('utf8'));
  const eventId = req.headers['x-razorpay-event-id'];

  if (!eventId || typeof eventId !== 'string') {
    throw fail(400, 'Missing webhook event ID');
  }

  if (await PaymentEvent.exists({ eventId })) {
    return res.json({
      ok: true,
      duplicate: true
    });
  }

  const payment = event.payload?.payment?.entity;
  const orderId = payment?.order_id;

  const stored = orderId
    ? await Payment.findOne({ orderId })
    : null;

  if (
    stored &&
    payment.amount === stored.amountPaise &&
    payment.currency === 'INR'
  ) {
    if (
      event.event === 'payment.captured' &&
      payment.status === 'captured'
    ) {
      await markPaid(orderId, payment.id);
    }

    if (
      event.event === 'payment.failed' &&
      stored.status === 'created'
    ) {
      stored.status = 'failed';
      await stored.save();
    }
  }

  await PaymentEvent.updateOne(
    { eventId },
    {
      $setOnInsert: {
        eventType: event.event
      }
    },
    { upsert: true }
  );

  res.json({ ok: true });
});

export default router;

