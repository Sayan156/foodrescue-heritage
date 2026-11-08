import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const options = { timestamps: true };

export const Notification = model('Notification', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: String,
  message: String,
  readAt: Date,
}, options));

export const AuditLog = model('AuditLog', new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'User' },
  entityType: String,
  entityId: { type: Schema.Types.ObjectId, refPath: 'entityType' },
  action: String,
  detail: Schema.Types.Mixed,
}, options));
