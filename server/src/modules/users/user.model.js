import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const options = { timestamps: true };
const locationSchema = new Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: undefined },
}, { _id: false });

export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  tokenVersion: { type: Number, default: 0 },
  resetTokenHash: { type: String, select: false },
  resetTokenExpiresAt: { type: Date, select: false },
  role: { type: String, enum: ['donor', 'ngo', 'volunteer', 'admin'], required: true },
  status: { type: String, enum: ['pending', 'verified', 'rejected', 'suspended'], default: 'pending' },
  phone: String,
}, options));

const organizationSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['restaurant', 'hotel', 'grocery', 'caterer', 'ngo', 'other'], default: 'other' },
  address: String,
  description: String,
  location: locationSchema,
}, options);
organizationSchema.index({ location: '2dsphere' }, { sparse: true });
export const Organization = model('Organization', organizationSchema);
