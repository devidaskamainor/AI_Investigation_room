import { randomBytes, timingSafeEqual } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { objectId } from '../../../shared/schemas/index.js';
import { Mystery } from '../models/index.js';
import { AppError, missing } from './errors.js';
export function authenticate(req, _res, next) {
  if (!req.session.userId)
    return next(new AppError(401, 'UNAUTHORIZED', 'Please sign in to continue.'));
  req.userId = req.session.userId;
  next();
}
export function csrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
  return req.session.csrfToken;
}
export function isAllowedOrigin(origin, env) {
  try {
    const requested = new URL(origin);
    const configured = new URL(env.CLIENT_URL);
    if (requested.origin !== origin) return false;
    if (requested.origin === configured.origin) return true;
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
    return (
      env.NODE_ENV === 'development' &&
      loopback.has(requested.hostname) &&
      loopback.has(configured.hostname) &&
      requested.protocol === configured.protocol &&
      requested.port === configured.port
    );
  } catch {
    return false;
  }
}
export const csrf = (env) => (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('origin') && !isAllowedOrigin(req.get('origin'), env))
    return next(
      new AppError(
        403,
        'ORIGIN_NOT_ALLOWED',
        'This page address is not allowed. Open the app using its configured address.',
      ),
    );
  const supplied = req.get('X-CSRF-Token') || '',
    expected = req.session.csrfToken || '';
  const suppliedBytes = Buffer.from(supplied),
    expectedBytes = Buffer.from(expected);
  if (
    !expected ||
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  )
    return next(new AppError(403, 'CSRF_ERROR', 'Your session changed. Refresh and try again.'));
  next();
};
export function validateIds(req, _res, next) {
  try {
    for (const [name, value] of Object.entries(req.params))
      if (name.endsWith('Id') || name === 'id') objectId.parse(value);
    next();
  } catch (e) {
    next(e);
  }
}
export async function ownedMystery(userId, id, ready = false) {
  objectId.parse(String(id));
  const mystery = await Mystery.findOne({ _id: id, ownerId: userId });
  if (!mystery) throw missing();
  if (ready && mystery.status !== 'ready')
    throw new AppError(409, 'MYSTERY_NOT_READY', 'This case is not ready yet.');
  return mystery;
}
export function limiter(windowMs, limit, keyGenerator) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        },
      }),
  });
}
