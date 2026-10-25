import { Router } from 'express';
import { authenticate, validateIds, limiter } from '../middleware/security.js';
import { asyncRoute } from '../middleware/errors.js';
import { resultsController as c } from '../controllers/results.controller.js';
export function resultsRoutes({ rateLimits = true } = {}) {
  const r = Router({ mergeParams: true });
  r.use(authenticate, validateIds);
  if (rateLimits)
    r.use(
      '/accusation',
      limiter(3600000, 30, (req) => req.userId),
    );
  r.post('/accusation', asyncRoute(c.accuse));
  r.get('/results', asyncRoute(c.get));
  return r;
}
