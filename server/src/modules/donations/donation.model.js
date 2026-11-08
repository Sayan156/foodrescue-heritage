import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const options = { timestamps: true };
const locationSchema = new Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: undefined },
}, { _id: false });

const donationSchema = new Schema({
  donor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  description: String,
  quantityTotal: { type: Number, required: true, min: 1 },
  quantityAvailable: { type: Number, required: true, min: 0 },
  unit: { type: String, enum: ['meals', 'kg', 'packs', 'pieces'], default: 'meals' },
  preparedAt: { type: Date, required: true },
  pickupDeadline: { type: Date, required: true, index: true },
  storageInfo: { type: String, required: true },
  handlingInstructions: String,
  address: { type: String, required: true },
  location: locationSchema,
  status: { type: String, enum: ['draft', 'available', 'requested', 'reserved', 'picked_up', 'distributed', 'expired', 'cancelled'], default: 'available', index: true },
}, options);
donationSchema.index({ location: '2dsphere' }, { sparse: true });
export const Donation = model('Donation', donationSchema);
