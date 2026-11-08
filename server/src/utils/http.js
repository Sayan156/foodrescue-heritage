export const run = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export const fail = (status, message) => Object.assign(new Error(message), { status });
export const validate = (schema, body) => schema.parse(body);
export const id = value => /^[a-f0-9]{24}$/i.test(value || '');

export async function notify(user, title, message) {
  const { Notification } = await import('../modules/notifications/notification.model.js');
  await Notification.create({ user, title, message });
}

export async function audit(actor, entityType, entityId, action, detail = {}) {
  const { AuditLog } = await import('../modules/notifications/notification.model.js');
  await AuditLog.create({ actor, entityType, entityId, action, detail });
}
