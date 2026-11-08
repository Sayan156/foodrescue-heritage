import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Donation } from '../donations/donation.model.js';
import { DonationRequest } from '../requests/request.model.js';
import { Assignment, DeliveryRecord } from './assignment.model.js';
import { User } from '../users/user.model.js';
import { run, fail, validate, notify, audit } from '../../utils/http.js';
import { requireAuth } from '../../middleware/authenticate.js';
import { roles, verified } from '../../middleware/authorize.js';

const router = Router();
router.post('/requests/:id/assignments', requireAuth, roles('donor', 'admin'), verified, run(async (req, res) => {
  const { volunteerId } = validate(z.object({ volunteerId: z.string().regex(/^[a-f\d]{24}$/i, 'Choose a volunteer before assigning pickup') }), req.body);
  const { assignment, request, donation, volunteer } = await mongoose.connection.transaction(async session => {
    const request = await DonationRequest.findById(req.params.id).session(session);
    if (!request || !['approved', 'partially_approved'].includes(request.status)) throw fail(409, 'Request is not approved');
    const donation = await Donation.findById(request.donation).session(session);
    if (!donation) throw fail(404, 'Donation not found');
    if (req.user.role !== 'admin' && String(donation.donor) !== req.user.id) throw fail(403, 'Not your donation');
    const volunteer = await User.findOne({ _id: volunteerId, role: 'volunteer', status: 'verified' }).session(session);
    if (!volunteer) throw fail(404, 'Volunteer not found');
    const [assignment] = await Assignment.create([{ request: request.id, volunteer: volunteer.id, assignedBy: req.user.id }], { session });
    request.status = 'assigned'; await request.save({ session });
    return { assignment, request, donation, volunteer };
  });
  await notify(volunteer.id, 'New assignment', `Pickup assigned for ${donation.title}`);
  await notify(request.ngo, 'Pickup assigned', `${volunteer.name} will collect ${request.approvedQuantity} ${donation.unit} of ${donation.title}.`);
  await audit(req.user.id, 'Assignment', assignment.id, 'created');
  res.status(201).json({ assignment });
}));
router.get('/assignments/receiving', requireAuth, roles('ngo'), verified, run(async (req, res) => {
  const ids = await DonationRequest.find({ ngo: req.user.id, status: 'assigned' }).distinct('_id');
  const items = await Assignment.find({ request: { $in: ids } }).populate({ path: 'request', populate: { path: 'donation', select: 'title unit' } }).sort({ createdAt: -1 });
  res.json({ items });
}));
router.get('/assignments/mine', requireAuth, roles('volunteer'), run(async (req, res) => {
  const items = await Assignment.find({ volunteer: req.user.id }).populate({ path: 'request', populate: { path: 'donation', select: 'title address unit pickupDeadline storageInfo handlingInstructions' } }).sort({ createdAt: -1 });
  res.json({ items });
}));
router.get('/volunteers', requireAuth, roles('donor', 'admin'), run(async (req, res) => {
  res.json({ items: await User.find({ role: 'volunteer', status: 'verified' }).select('name').limit(100) });
}));
router.patch('/assignments/:id/status', requireAuth, roles('volunteer'), verified, run(async (req, res) => {
  const { status, collectedQuantity, notes } = validate(z.object({
    status: z.enum(['accepted', 'en_route', 'collected', 'failed']),
    collectedQuantity: z.coerce.number().positive().optional(), notes: z.string().trim().max(500).optional(),
  }), req.body);
  const { assignment, request, donation } = await mongoose.connection.transaction(async session => {
    const assignment = await Assignment.findOne({ _id: req.params.id, volunteer: req.user.id }).session(session);
    if (!assignment) throw fail(404, 'Assignment not found');
    const next = { assigned: 'accepted', accepted: 'en_route', en_route: 'collected' };
    if ((status === 'failed' && !['assigned', 'accepted', 'en_route'].includes(assignment.status)) || (status !== 'failed' && next[assignment.status] !== status)) throw fail(409, 'Invalid status transition');
    const request = await DonationRequest.findById(assignment.request).session(session);
    if (!request || request.status !== 'assigned') throw fail(409, 'Request is no longer assigned');
    if (status === 'collected' && (!collectedQuantity || collectedQuantity > request.approvedQuantity)) throw fail(400, 'Actual pickup quantity must be positive and not exceed approved quantity');
    assignment.status = status;
    if (status === 'collected') { assignment.collectedQuantity = collectedQuantity; assignment.collectedAt = new Date(); }
    assignment.notes = notes ?? assignment.notes;
    await assignment.save({ session });
    return { assignment, request, donation: await Donation.findById(request.donation).session(session) };
  });
  await audit(req.user.id, 'Assignment', assignment.id, 'status', { status });
  if (status === 'collected') await notify(request.ngo, 'Food collected', `${req.user.name} collected ${collectedQuantity} ${donation.unit} of ${donation.title}. Confirm receipt when it arrives.`);
  if (status === 'failed') {
    await notify(request.ngo, 'Pickup failed', `Pickup for ${donation.title} failed. ${notes || ''} You can cancel the request to release the reserved food.`);
    await notify(donation.donor, 'Pickup failed', `Pickup for ${donation.title} failed. ${notes || ''}`);
  }
  res.json({ assignment });
}));
router.post('/assignments/:id/confirmation', requireAuth, roles('ngo'), verified, run(async (req, res) => {
  const data = validate(z.object({
    deliveredQuantity: z.coerce.number().min(0), distributedQuantity: z.coerce.number().min(0).optional(),
    beneficiaries: z.coerce.number().int().min(0).default(0), conditionNotes: z.string().max(1000).optional(),
  }), req.body);
  const record = await mongoose.connection.transaction(async session => {
    const assignment = await Assignment.findById(req.params.id).session(session);
    if (!assignment || assignment.status !== 'collected') throw fail(409, 'Assignment not ready for delivery confirmation');
    const request = await DonationRequest.findById(assignment.request).session(session);
    if (!request || String(request.ngo) !== req.user.id) throw fail(403, 'Not your request');
    if (data.deliveredQuantity > assignment.collectedQuantity || data.distributedQuantity > data.deliveredQuantity) throw fail(400, 'Invalid delivered/distributed quantity');
    const [record] = await DeliveryRecord.create([{ assignment: assignment.id, receivedBy: req.user.id, ...data }], { session });
    assignment.status = 'delivered'; assignment.deliveredAt = new Date(); await assignment.save({ session });
    request.status = 'delivered'; await request.save({ session });
    return record;
  });
  await audit(req.user.id, 'DeliveryRecord', record.id, 'confirmed');
  res.status(201).json({ record });
}));
export default router;
