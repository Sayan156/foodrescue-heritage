import jwt from 'jsonwebtoken';
import { User } from '../modules/users/user.model.js';

export function issueToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, version: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '12h' });
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!/^[a-f\d]{24}$/i.test(payload.sub || '')) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Account no longer exists' });
    if ((payload.version || 0) !== (user.tokenVersion || 0)) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    if (['suspended', 'rejected'].includes(user.status)) return res.status(403).json({ error: 'Account inaccessible', code: 'ACCOUNT_INACCESSIBLE' });
    req.user = user;
    return next();
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return next(Object.assign(new Error('Invalid or expired session'), { status: 401 }));
    }
    return next(error);
  }
}

export function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, phone: user.phone };
}
