import { Router } from 'express';
import { authenticate, validateIds } from '../middleware/security.js';
import { asyncRoute } from '../middleware/errors.js';
import { assetsController } from '../controllers/assets.controller.js';
export function assetRoutes(storage) {
  const r = Router(),
    c = assetsController(storage);
  r.use(authenticate);
  r.get('/assets/:assetId', validateIds, asyncRoute(c.read));
  r.delete('/mysteries/:id', validateIds, asyncRoute(c.delete));
  return r;
}
