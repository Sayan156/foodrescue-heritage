import express from 'express';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './modules/auth/auth.routes.js';
import donationRoutes from './modules/donations/donation.routes.js';
import requestRoutes from './modules/requests/request.routes.js';
import assignmentRoutes from './modules/assignments/assignment.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import paymentRoutes, { webhook } from './modules/payments/payment.routes.js';
import userRoutes from './modules/users/user.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { connectDatabase } from './config/database.js';

export const app = express();
app.disable('x-powered-by');
// Set to the actual trusted proxy hop count on the production host.
if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
app.use(helmet({ contentSecurityPolicy: { directives: {
  scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
  imgSrc: ["'self'", 'data:', 'https://images.unsplash.com', 'https://*.razorpay.com'],
  frameSrc: ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
  connectSrc: ["'self'", 'https://api.razorpay.com'],
} } }));
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(value => value.trim());
app.use(cors({ origin: origins }));

// Vercel loads this exported app without running the local server entry point.
if (process.env.VERCEL === '1') {
  app.use(async (req, res, next) => {
    if (!process.env.MONGODB_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(503).json({ error: 'Server configuration is incomplete' });
    }
    try {
      await connectDatabase();
      next();
    } catch {
      res.status(503).json({ error: 'Database connection unavailable' });
    }
  });
}

app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '256kb' }), webhook);
app.use(express.json({ limit: '200kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 250, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, skip: req => req.method === 'GET' || req.method === 'PATCH', skipSuccessfulRequests: true, message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' } }), authRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api', requestRoutes);
app.use('/api', assignmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }), paymentRoutes);
app.use('/api', userRoutes);
app.use('/api', notificationRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'FoodRescue API' }));
if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
  const clientDist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  app.use(express.static(clientDist, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile('index.html', { root: clientDist });
  });
}
app.use((req, res) => res.status(404).json({ error: 'API route not found' }));
app.use(errorHandler);
export default app;
