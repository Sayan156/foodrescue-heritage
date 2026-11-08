export const roles = (...allowed) => (req, res, next) => (
  allowed.includes(req.user?.role)
    ? next()
    : next(Object.assign(new Error('Access denied'), { status: 403 }))
);

export const verified = (req, res, next) => (
  req.user?.status === 'verified'
    ? next()
    : next(Object.assign(new Error('Account must be verified'), { status: 403 }))
);
