import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const requestSchema = new Schema({
  donation: { type: Schema.Types.ObjectId, ref: 'Donation', required: true, index: true },
  ngo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requestedQuantity: { type: Number, required: true, min: 1 },
  approvedQuantity: { type: Number, default: 0, min: 0 },
  beneficiaryEstimate: { type: Number, default: 0 },
  collectionPlan: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'partially_approved', 'rejected', 'cancelled', 'assigned', 'delivered'], default: 'pending' },
}, { timestamps: true });
requestSchema.index({ donation: 1, ngo: 1 });
export const DonationRequest = model('DonationRequest', requestSchema);
