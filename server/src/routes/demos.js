import { Router } from 'express';
import { authenticate } from '../middleware/security.js';
import { asyncRoute, missing } from '../middleware/errors.js';
import { demoController } from '../controllers/demo.controller.js';
export function demoRoutes(env, storage) {
  const r = Router(),
    c = demoController(env, storage);
  r.use(authenticate, (_req, _res, next) => (env.DEMO_MODE ? next() : next(missing())));
  r.get('/', asyncRoute(c.list));
  r.post('/:slug', asyncRoute(c.import));
  return r;
}
