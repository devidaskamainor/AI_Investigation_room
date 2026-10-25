import { Router } from 'express';
import { authenticate, validateIds } from '../middleware/security.js';
import { asyncRoute } from '../middleware/errors.js';
import { mysteryController } from '../controllers/mystery.controller.js';
export function mysteryRoutes(env) {
  const r = Router(),
    c = mysteryController(env);
  r.use(authenticate);
  r.post('/mysteries', asyncRoute(c.create));
  r.get('/mysteries', asyncRoute(c.list));
  r.get('/mysteries/:id', validateIds, asyncRoute(c.get));
  r.get('/generation-jobs/:jobId', validateIds, asyncRoute(c.job));
  r.post('/generation-jobs/:jobId/retry', validateIds, asyncRoute(c.retry));
  return r;
}
