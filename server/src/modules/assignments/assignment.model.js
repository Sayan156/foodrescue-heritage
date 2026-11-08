import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const options = { timestamps: true };

export const Assignment = model('Assignment', new Schema({
  request: { type: Schema.Types.ObjectId, ref: 'DonationRequest', required: true, unique: true },
  volunteer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['assigned', 'accepted', 'en_route', 'collected', 'delivered', 'failed', 'cancelled'], default: 'assigned' },
  collectedQuantity: { type: Number, min: 0 },
  collectedAt: Date,
  deliveredAt: Date,
  notes: String,
}, options));

export const DeliveryRecord = model('DeliveryRecord', new Schema({
  assignment: { type: Schema.Types.ObjectId, ref: 'Assignment', unique: true, required: true },
  receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deliveredQuantity: { type: Number, required: true, min: 0 },
  distributedQuantity: { type: Number, min: 0 },
  conditionNotes: String,
  beneficiaries: { type: Number, min: 0, default: 0 },
  receivedAt: { type: Date, default: Date.now },
}, options));
