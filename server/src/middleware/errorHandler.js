import { ZodError } from 'zod';

export function errorHandler(error, req, res, next) {
  if (['MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoServerSelectionError', 'MongooseServerSelectionError'].includes(error.name) || /buffering timed out|before initial connection/i.test(error.message)) {
    return res.status(503).json({ error: 'Database temporarily unavailable. Please try again shortly.' });
  }
  if (error.code === 20 && /Transaction/.test(error.message)) return res.status(503).json({ error: 'This operation requires a MongoDB replica set. Please contact the administrator.' });
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Invalid input',
      details: error.errors.map(issue => ({ field: issue.path.join('.'), message: issue.message })),
    });
  }
  if (error.code === 11000) return res.status(409).json({ error: 'Record already exists' });
  if (error.name === 'CastError') return res.status(400).json({ error: 'Invalid identifier' });
  if (error.name === 'ValidationError') return res.status(400).json({ error: 'Invalid record', details: error.message });
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: 'Internal server error' });
}
