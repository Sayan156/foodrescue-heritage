import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Organization } from '../users/user.model.js';
import { issueToken, safeUser } from '../../middleware/authenticate.js';
import { fail } from '../../utils/http.js';

const sessionResponse = user => ({ user: safeUser(user), token: issueToken(user) });

export async function registerAccount(data) {
  if (await User.exists({ email: data.email })) throw fail(409, 'Email already registered');
  const passwordHash = await bcrypt.hash(data.password, 12);
  // User and organization must either both exist or neither exist.
  const user = await mongoose.connection.transaction(async session => {
    const [created] = await User.create([{
      name: data.name, email: data.email, passwordHash, role: data.role,
      status: data.role === 'volunteer' ? 'verified' : 'pending',
    }], { session });
    if (data.role !== 'volunteer') await Organization.create([{
      owner: created.id, name: data.organizationName,
      type: data.role === 'ngo' ? 'ngo' : (data.organizationType || 'other'),
    }], { session });
    return created;
  });
  return sessionResponse(user);
}

export async function loginAccount({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !await bcrypt.compare(password, user.passwordHash)) throw fail(401, 'Invalid email or password');
  if (['rejected', 'suspended'].includes(user.status)) throw fail(403, 'Your account is unavailable. Contact the administrator.');
  return sessionResponse(user);
}
