import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const missing = () =>
  new AppError(404, 'RESOURCE_NOT_FOUND', 'This resource could not be found.');
export const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError)
    err = new AppError(
      400,
      'VALIDATION_ERROR',
      'The submitted information is invalid.',
      err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    );
  if (err.type === 'entity.too.large')
    err = new AppError(413, 'VALIDATION_ERROR', 'The request is too large.');
  if (err instanceof SyntaxError && 'body' in err)
    err = new AppError(400, 'VALIDATION_ERROR', 'Invalid JSON.');
  if (!(err instanceof AppError)) {
    logger.error({ requestId: req.id, code: 'INTERNAL_SERVER_ERROR' }, 'Request failed');
    err = new AppError(500, 'INTERNAL_SERVER_ERROR', 'Something went wrong. Please try again.');
  }
  res.status(err.status).json({
    success: false,
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
