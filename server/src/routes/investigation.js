import { Router } from 'express';
import { authenticate, validateIds, limiter } from '../middleware/security.js';
import { asyncRoute } from '../middleware/errors.js';
import { investigationController as c } from '../controllers/investigation.controller.js';
export function investigationRoutes({ rateLimits = true } = {}) {
  const r = Router({ mergeParams: true });
  r.use(authenticate, validateIds);
  r.get('/suspects', asyncRoute(c.suspects));
  r.get('/suspects/:suspectId', validateIds, asyncRoute(c.suspect));
  r.get('/evidence', asyncRoute(c.evidence));
  r.get('/evidence/:evidenceId', validateIds, asyncRoute(c.detail));
  r.post('/evidence/:evidenceId/view', validateIds, asyncRoute(c.view));
  r.get('/progress', asyncRoute(c.progress));
  r.post('/progress/notes', asyncRoute(c.noteCreate));
  r.patch('/progress/notes/:noteId', validateIds, asyncRoute(c.noteUpdate));
  r.delete('/progress/notes/:noteId', validateIds, asyncRoute(c.noteDelete));
  r.put('/progress/pins', asyncRoute(c.pins));
  if (rateLimits)
    r.use(
      '/hints',
      limiter(3600000, 30, (req) => req.userId),
    );
  r.post('/hints', asyncRoute(c.hint));
  return r;
}
