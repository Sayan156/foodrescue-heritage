import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID, createHash } from 'node:crypto';
import { requestPasswordReset } from '../src/modules/auth/password-reset.service.js';
import { app } from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';
import { issueToken, requireAuth } from '../src/middleware/authenticate.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

test('four roles, permissions, and donation-to-receipt workflow', { skip: process.env.RUN_DB_TESTS !== '1' }, async t => {
  const dbName = `foodrescue_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const password = 'Synthetic-Test-Password-123';
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function call(path, { token, body, method = body ? 'POST' : 'GET', status = 200 } = {}) {
    const response = await fetch(base + path, { method, headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  }
  const accounts = {};
  for (const role of ['donor', 'ngo', 'volunteer']) {
    accounts[role] = await call('/auth/register', { status: 201, body: {
      name: `Test ${role}`, email: ` ${role.toUpperCase()}@EXAMPLE.COM `, password, role,
      ...(role !== 'volunteer' ? { organizationName: `Test ${role} organization` } : {}),
    } });
    assert.equal(accounts[role].user.status, role === 'volunteer' ? 'verified' : 'pending');
  }
  await User.create({ name: 'Test admin', email: 'admin@example.com', role: 'admin', status: 'verified', passwordHash: await bcrypt.hash(password, 4) });
  for (const role of ['donor', 'ngo', 'volunteer', 'admin']) {
    accounts[role] = await call('/auth/login', { body: { email: ` ${role.toUpperCase()}@EXAMPLE.COM `, password } });
    assert.equal(accounts[role].user.role, role);
    assert.equal(accounts[role].user.passwordHash, undefined);
    await call('/auth/me', { token: accounts[role].token });
  }
  await call('/auth/login', { body: { email: 'donor@example.com', password: 'wrong' }, status: 401 });
  await call('/auth/register', { body: { name: 'Injected admin', email: 'bad@example.com', password, role: 'admin' }, status: 400 });
  for (const path of ['/assignments/mine', '/assignments/receiving', '/volunteers', '/admin/summary']) await call(path, { status: 401 });
  const donor = accounts.donor.token, ngo = accounts.ngo.token, volunteer = accounts.volunteer.token, admin = accounts.admin.token;
  const listing = { title: 'Synthetic rice meals', category: 'prepared', quantity: 10, unit: 'meals', preparedAt: new Date().toISOString(), pickupDeadline: new Date(Date.now() + 86400000).toISOString(), storageInfo: 'Synthetic storage note', address: 'Synthetic test address' };
  await call('/donations', { token: donor, body: listing, status: 403 });
  for (const role of ['donor', 'ngo']) await call(`/admin/users/${accounts[role].user.id}/status`, { token: admin, method: 'PATCH', body: { status: 'verified' } });
  await call('/donations', { token: donor, body: { ...listing, preparedAt: new Date(Date.now() + 3600000).toISOString() }, status: 400 });
  const { donation } = await call('/donations', { token: donor, body: listing, status: 201 });
  await call(`/donations/${donation._id}/requests`, { token: ngo, body: { requestedQuantity: 11, collectionPlan: 'Test pickup plan' }, status: 409 });
  const { request } = await call(`/donations/${donation._id}/requests`, { token: ngo, body: { requestedQuantity: 8, collectionPlan: 'Test pickup plan' }, status: 201 });
  await call(`/requests/${request._id}/decision`, { token: volunteer, method: 'PATCH', body: { decision: 'approve' }, status: 403 });
  await call(`/requests/${request._id}/decision`, { token: donor, method: 'PATCH', body: { decision: 'approve', approvedQuantity: 6 } });
  const own = await call('/donations?mine=true', { token: donor });
  assert.equal(own.items[0].quantityAvailable, 4);
  const directory = await call('/volunteers', { token: donor });
  assert.ok(directory.items.length);
  assert.deepEqual(Object.keys(directory.items[0]).sort(), ['_id', 'name']);
  await call(`/requests/${request._id}/assignments`, { token: donor, body: {}, status: 400 });
  await call('/volunteers', { token: ngo, status: 403 });
  const { assignment } = await call(`/requests/${request._id}/assignments`, { token: donor, body: { volunteerId: accounts.volunteer.user.id }, status: 201 });
  assert.equal((await call('/assignments/mine', { token: volunteer })).items.length, 1);
  await call('/assignments/receiving', { token: ngo });
  for (const status of ['accepted', 'en_route', 'collected']) await call(`/assignments/${assignment._id}/status`, { token: volunteer, method: 'PATCH', body: { status, ...(status === 'collected' ? { collectedQuantity: 6 } : {}) } });
  await call(`/requests/${request._id}/cancel`, { token: ngo, method: 'PATCH', body: {}, status: 409 });
  await call(`/assignments/${assignment._id}/confirmation`, { token: ngo, body: { deliveredQuantity: 7 }, status: 400 });
  await call(`/assignments/${assignment._id}/confirmation`, { token: ngo, body: { deliveredQuantity: 5, distributedQuantity: 6 }, status: 400 });
  const notices = await call('/notifications', { token: ngo });
  for (const title of ['Food request decision', 'Pickup assigned', 'Food collected']) {
    assert.ok(notices.items.some(n => n.title === title && n.message.includes(listing.title)), title);
  }
  await call(`/assignments/${assignment._id}/confirmation`, { token: ngo, body: { deliveredQuantity: 5, distributedQuantity: 5, beneficiaries: 5 }, status: 201 });
  assert.equal((await call('/dashboard/summary', { token: ngo })).completed, 1);
  await call('/admin/summary', { token: admin });
  const audit = await call('/admin/audit', { token: admin });
  assert.ok(audit.items.some(entry => entry.entityLabel === listing.title && entry.actor?.name === 'Test ngo'));
  assert.ok(audit.items.some(entry => entry.entityLabel === 'Test donor'));
  const { donation: editable } = await call('/donations', { token: donor, body: { ...listing, title: 'Editable listing' }, status: 201 });
  await call(`/donations/${editable._id}`, { token: donor, method: 'PATCH', body: { description: 'Updated description', handlingInstructions: 'Keep cool' } });
  const { request: pending } = await call(`/donations/${editable._id}/requests`, { token: ngo, body: { requestedQuantity: 3, collectionPlan: 'Test pickup plan' }, status: 201 });
  await call(`/requests/${pending._id}/cancel`, { token: donor, method: 'PATCH', body: {}, status: 403 });
  await call(`/requests/${pending._id}/cancel`, { token: ngo, method: 'PATCH', body: {} });
  await call(`/requests/${pending._id}/cancel`, { token: ngo, method: 'PATCH', body: {}, status: 409 });
  const { request: reserved } = await call(`/donations/${editable._id}/requests`, { token: ngo, body: { requestedQuantity: 3, collectionPlan: 'Test pickup plan' }, status: 201 });
  await call(`/requests/${reserved._id}/decision`, { token: donor, method: 'PATCH', body: { decision: 'approve' } });
  await call(`/donations/${editable._id}`, { token: donor, method: 'PATCH', body: { status: 'cancelled' }, status: 409 });
  await call(`/requests/${reserved._id}/cancel`, { token: ngo, method: 'PATCH', body: {} });
  assert.equal((await call(`/donations/${editable._id}`, { token: donor })).donation.quantityAvailable, 10);
  const { request: failed } = await call(`/donations/${editable._id}/requests`, { token: ngo, body: { requestedQuantity: 4, collectionPlan: 'Test pickup plan' }, status: 201 });
  await call(`/requests/${failed._id}/decision`, { token: donor, method: 'PATCH', body: { decision: 'approve' } });
  const { assignment: failedPickup } = await call(`/requests/${failed._id}/assignments`, { token: donor, body: { volunteerId: accounts.volunteer.user.id }, status: 201 });
  await call(`/assignments/${failedPickup._id}/status`, { token: volunteer, method: 'PATCH', body: { status: 'failed', notes: 'Vehicle unavailable' } });
  await call(`/requests/${failed._id}/cancel`, { token: ngo, method: 'PATCH', body: {} });
  assert.equal((await call(`/donations/${editable._id}`, { token: donor })).donation.quantityAvailable, 10);
  const { request: active } = await call(`/donations/${editable._id}/requests`, { token: ngo, body: { requestedQuantity: 2, collectionPlan: 'Test pickup plan' }, status: 201 });
  await call(`/requests/${active._id}/decision`, { token: donor, method: 'PATCH', body: { decision: 'approve' } });
  const { assignment: activePickup } = await call(`/requests/${active._id}/assignments`, { token: donor, body: { volunteerId: accounts.volunteer.user.id }, status: 201 });
  await call(`/requests/${active._id}/cancel`, { token: ngo, method: 'PATCH', body: {} });
  await call(`/assignments/${activePickup._id}/status`, { token: volunteer, method: 'PATCH', body: { status: 'accepted' }, status: 409 });
  assert.equal((await call(`/donations/${editable._id}`, { token: donor })).donation.quantityAvailable, 10);
  const { request: donorCancelled } = await call(`/donations/${editable._id}/requests`, { token: ngo, body: { requestedQuantity: 3, collectionPlan: 'Test pickup plan' }, status: 201 });
  await call(`/donations/${editable._id}`, { token: donor, method: 'PATCH', body: { status: 'cancelled' } });
  assert.equal((await call('/requests/mine', { token: ngo })).items.find(r => r._id === donorCancelled._id).status, 'cancelled');
  await call(`/requests/${donorCancelled._id}/decision`, { token: donor, method: 'PATCH', body: { decision: 'approve' }, status: 409 });

  // Exercise recovery without sending real mail or exposing reset tokens over the API.
  process.env.PUBLIC_APP_URL = 'http://localhost:5173';
  process.env.RESEND_API_KEY = 'synthetic-test-key';
  process.env.EMAIL_FROM = 'tests@example.com';
  let resetUrl;
  const recovered = await requestPasswordReset('donor@example.com', async mail => { resetUrl = mail.url; });
  const unknown = await requestPasswordReset('unknown@example.com', async () => { assert.fail('Unknown account must not receive mail'); });
  assert.deepEqual(recovered, unknown);
  const expiredToken = new URLSearchParams(new URL(resetUrl).hash.slice(1)).get('token');
  await User.updateOne({ _id: accounts.donor.user.id }, { $set: { resetTokenExpiresAt: new Date(Date.now() - 1000) } });
  await call('/auth/reset-password', { body: { token: expiredToken, password: 'Expired-Test-Password-123' }, status: 400 });
  await requestPasswordReset('donor@example.com', async mail => { resetUrl = mail.url; });
  const resetToken = new URLSearchParams(new URL(resetUrl).hash.slice(1)).get('token');
  const stored = await User.findById(accounts.donor.user.id).select('+resetTokenHash');
  assert.equal(stored.resetTokenHash, createHash('sha256').update(resetToken).digest('hex'));
  const newPassword = 'Replacement-Test-Password-456';
  await call('/auth/reset-password', { body: { token: resetToken, password: newPassword } });
  await call('/auth/reset-password', { body: { token: resetToken, password: newPassword }, status: 400 });
  await call('/auth/me', { token: donor, status: 401 });
  await call('/auth/login', { body: { email: 'donor@example.com', password }, status: 401 });
  await call('/auth/login', { body: { email: 'donor@example.com', password: newPassword } });

  await call('/admin/summary', { token: ngo, status: 403 });
  await call(`/admin/users/${accounts.volunteer.user.id}/status`, { token: admin, method: 'PATCH', body: { status: 'suspended' } });
  await call('/auth/me', { token: volunteer, status: 403 });
  await call('/auth/login', { body: { email: 'volunteer@example.com', password }, status: 403 });
});

test('bad tokens and database outages have distinct responses', async () => {
  let forwarded;
  await requireAuth({ headers: { authorization: 'Bearer invalid' } }, {}, error => { forwarded = error; });
  assert.equal(forwarded.status, 401);
  let status, body;
  errorHandler(Object.assign(new Error('Unavailable'), { name: 'MongoServerSelectionError' }), {}, {
    status(value) { status = value; return this; }, json(value) { body = value; },
  }, () => {});
  assert.equal(status, 503);
  assert.match(body.error, /temporarily unavailable/);
});


test('authentication does not turn a database failure into an invalid session', async () => {
  const original = User.findById;
  const outage = Object.assign(new Error('Unavailable'), { name: 'MongoNetworkError' });
  User.findById = async () => { throw outage; };
  try {
    let forwarded;
    const token = issueToken({ _id: '507f1f77bcf86cd799439011', role: 'donor' });
    await requireAuth({ headers: { authorization: `Bearer ${token}` } }, {}, error => { forwarded = error; });
    assert.equal(forwarded, outage);
    assert.equal(forwarded.status, undefined);
  } finally { User.findById = original; }
});
