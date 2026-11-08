import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Donation } from '../donations/donation.model.js';
import { DonationRequest } from './request.model.js';
import { Assignment } from '../assignments/assignment.model.js';
import { run, fail, validate, notify, audit } from '../../utils/http.js';
import { requireAuth } from '../../middleware/authenticate.js';
import { roles, verified } from '../../middleware/authorize.js';

const router = Router();
router.get('/requests/mine', requireAuth, roles('ngo'), run(async (req, res) => {
  res.json({ items: await DonationRequest.find({ ngo: req.user.id }).populate('donation', 'title unit pickupDeadline').sort({ createdAt: -1 }) });
}));
router.patch('/requests/:id/decision', requireAuth, roles('donor', 'admin'), verified, run(async (req, res) => {
  const { decision, approvedQuantity } = validate(z.object({ decision: z.enum(['approve', 'reject']), approvedQuantity: z.coerce.number().int().min(0).optional() }), req.body);
  const result = await mongoose.connection.transaction(async session => {
    const request = await DonationRequest.findById(req.params.id).session(session);
    if (!request || request.status !== 'pending') throw fail(409, 'Request not pending');
    const donation = await Donation.findById(request.donation).session(session);
    if (!donation) throw fail(404, 'Donation not found');
    if (req.user.role !== 'admin' && String(donation.donor) !== req.user.id) throw fail(403, 'Not your listing');
    if (decision === 'reject') { request.status = 'rejected'; request.approvedQuantity = 0; }
    else {
      const qty = approvedQuantity ?? request.requestedQuantity;
      if (qty < 1 || qty > request.requestedQuantity) throw fail(400, 'Approval quantity must fit the request');
      const allocated = await Donation.updateOne({ _id: donation.id, quantityAvailable: { $gte: qty }, pickupDeadline: { $gt: new Date() }, status: { $in: ['available', 'requested'] } }, { $inc: { quantityAvailable: -qty } }, { session });
      if (allocated.modifiedCount !== 1) throw fail(409, 'Not enough unreserved food or listing expired');
      request.approvedQuantity = qty;
      request.status = qty === request.requestedQuantity ? 'approved' : 'partially_approved';
    }
    await request.save({ session });
    return { request, donation };
  });
  const { request, donation } = result;
  await audit(req.user.id, 'DonationRequest', request.id, 'decision', { decision, approvedQuantity: request.approvedQuantity });
  await notify(request.ngo, 'Food request decision', `${donation.title}: request ${request.status.replaceAll('_', ' ')}${decision === 'approve' ? ` for ${request.approvedQuantity} ${donation.unit}` : ''}.`);
  res.json({ request });
}));
router.patch('/requests/:id/cancel', requireAuth, roles('ngo'), verified, run(async (req, res) => {
  const result = await mongoose.connection.transaction(async session => {
    const request = await DonationRequest.findOne({ _id: req.params.id, ngo: req.user.id }).session(session);
    if (!request) throw fail(404, 'Own request not found');
    if (!['pending', 'approved', 'partially_approved', 'assigned'].includes(request.status)) throw fail(409, 'This request cannot be cancelled');
    const assignment = await Assignment.findOne({ request: request.id }).session(session);
    if (assignment && ['collected', 'delivered'].includes(assignment.status)) throw fail(409, 'Food has already been collected; this request cannot be cancelled');
    if (assignment) { assignment.status = 'cancelled'; await assignment.save({ session }); }
    const donation = await Donation.findById(request.donation).session(session);
    if (!donation) throw fail(404, 'Donation not found');
    if (request.approvedQuantity) {
      donation.quantityAvailable += request.approvedQuantity;
      await donation.save({ session });
    }
    request.status = 'cancelled';
    await request.save({ session });
    return { request, donation, assignment };
  });
  await audit(req.user.id, 'DonationRequest', result.request.id, 'cancelled');
  await notify(result.donation.donor, 'Food request cancelled', `${req.user.name} cancelled their request for ${result.donation.title}.`);
  if (result.assignment) await notify(result.assignment.volunteer, 'Pickup cancelled', `Pickup for ${result.donation.title} was cancelled by the recipient.`);
  res.json({ request: result.request });
}));
export default router;
