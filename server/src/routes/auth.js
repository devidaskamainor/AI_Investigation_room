import { Router } from 'express';
import { authenticate, limiter } from '../middleware/security.js';
import { asyncRoute } from '../middleware/errors.js';
import { authController } from '../controllers/auth.controller.js';
export function authRoutes(env, options = {}) {
  const r = Router(),
    c = authController(env, options),
    pass = (_req, _res, next) => next(),
    recovery = options.rateLimits !== false ? limiter(3600000, 5) : pass,
    login = options.rateLimits !== false ? limiter(900000, 10) : pass,
    email =
      options.rateLimits !== false
        ? limiter(900000, 10, (req) =>
            String(req.body?.email || '')
              .trim()
              .toLowerCase(),
          )
        : pass;
  r.get('/csrf', asyncRoute(c.csrf));
  r.post('/register', recovery, asyncRoute(c.register));
  r.post('/login', login, email, asyncRoute(c.login));
  r.post('/logout', authenticate, asyncRoute(c.logout));
  r.get('/me', authenticate, asyncRoute(c.me));
  r.post('/forgot-password', recovery, asyncRoute(c.forgot));
  r.post('/reset-password', recovery, asyncRoute(c.reset));
  return r;
}
