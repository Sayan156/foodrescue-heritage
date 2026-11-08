import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const options = { timestamps: true };

export const Payment = model('Payment', new Schema({
  sponsor: { type: Schema.Types.ObjectId, ref: 'User' },
  sponsorName: { type: String, required: true },
  sponsorEmail: { type: String, required: true },
  purpose: { type: String, enum: ['general', 'logistics'], default: 'general' },
  amountPaise: { type: Number, required: true, min: 100 },
  currency: { type: String, default: 'INR' },
  orderId: { type: String, unique: true, required: true },
  paymentId: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ['created', 'authorized', 'paid', 'failed', 'refunded'], default: 'created' },
  confirmedAt: Date,
}, options));

export const PaymentEvent = model('PaymentEvent', new Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: String,
  processedAt: { type: Date, default: Date.now },
}, options));
