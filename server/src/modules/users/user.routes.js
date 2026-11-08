import { Router } from 'express';
import { requireAuth } from '../../middleware/authenticate.js';
import { run } from '../../utils/http.js';
import { Donation } from '../donations/donation.model.js';
import { DonationRequest } from '../requests/request.model.js';
import { Assignment } from '../assignments/assignment.model.js';

const router = Router();
router.get('/dashboard/summary', requireAuth, run(async (req, res) => {
  const id = req.user.id;
  const role = req.user.role;
  let result = {};
  if (role === 'donor') {
    const [listings, requests] = await Promise.all([
      Donation.countDocuments({ donor: id }),
      DonationRequest.countDocuments({ donation: { $in: await Donation.find({ donor: id }).distinct('_id') }, status: 'pending' }),
    ]);
    result = { listings, requests };
  }
  if (role === 'ngo') result = { requests: await DonationRequest.countDocuments({ ngo: id }), completed: await DonationRequest.countDocuments({ ngo: id, status: 'delivered' }) };
  if (role === 'volunteer') result = { assignments: await Assignment.countDocuments({ volunteer: id }), completed: await Assignment.countDocuments({ volunteer: id, status: 'delivered' }) };
  res.json(result);
}));
export default router;
