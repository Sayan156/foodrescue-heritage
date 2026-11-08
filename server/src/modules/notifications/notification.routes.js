import { Router } from 'express';
import { requireAuth } from '../../middleware/authenticate.js';
import { run } from '../../utils/http.js';
import { Notification } from './notification.model.js';

const router = Router();
router.get('/notifications', requireAuth, run(async (req, res) => {
  res.json({ items: await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(60) });
}));
router.patch('/notifications/:id/read', requireAuth, run(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $set: { readAt: new Date() } },
    { new: true },
  );
  if (!notification) return res.status(404).json({ error: 'Not found' });
  res.json({ notification });
}));
export default router;
