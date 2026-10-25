import { resolve } from 'node:path';
import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { logger } from './config/logger.js';
import { csrf, limiter, isAllowedOrigin } from './middleware/security.js';
import { errorHandler, missing } from './middleware/errors.js';
import { authRoutes } from './routes/auth.js';
import { mysteryRoutes } from './routes/mysteries.js';
import { assetRoutes } from './routes/assets.js';
import { storageProvider } from './services/assets/storage.provider.js';
import { investigationRoutes } from './routes/investigation.js';
import { resultsRoutes } from './routes/results.js';
import { demoRoutes } from './routes/demos.js';
import { z } from 'zod';
export function createApp(env, options = {}) {
  const app = express();
  app.disable('x-powered-by');
 app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : 'loopback');
  app.use(
    pinoHttp({
      logger,
      genReqId: () => randomUUID(),
      autoLogging: env.NODE_ENV !== 'test',
      serializers: {
        req: (r) => ({ id: r.id, method: r.method, path: r.url?.split('?')[0] }),
        res: (r) => ({ statusCode: r.statusCode }),
        err: () => ({ code: 'REQUEST_ERROR' }),
      },
    }),
  );
  app.use(
    helmet(),
    cors({
      origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin, env)),
      credentials: true,
    }),
    compression(),
    express.json({ limit: '20kb' }),
    mongoSanitize(),
  );
  app.get('/api/v1/health', (_req, res) =>
    res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
      success: mongoose.connection.readyState === 1,
      data: {
        process: 'ok',
        database: mongoose.connection.readyState === 1 ? 'ok' : 'unavailable',
      },
    }),
  );
  const store =
    options.sessionStore ||
    MongoStore.create({ client: mongoose.connection.getClient(), touchAfter: 60, ttl: 604800 });
  app.locals.sessionStore = store;
  app.use(
    session({
      name: 'mr.sid',
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store,
      cookie: {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 604800000,
        ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
      },
    }),
  );
  app.use('/api/v1', csrf(env));
  app.use('/api/v1', (req, _res, next) => {
    const acceptsQuery =
      req.method === 'GET' &&
      (req.path === '/mysteries' || /^\/mysteries\/[a-f0-9]{24}\/evidence$/i.test(req.path));
    if (!acceptsQuery) z.object({}).strict().parse(req.query);
    next();
  });
  if (options.rateLimits !== false) app.use('/api/v1', limiter(900000, 300));
  app.use('/api/v1/auth', authRoutes(env, options));
  app.use('/api/v1', mysteryRoutes(env));
  app.use('/api/v1', assetRoutes(options.storage || storageProvider(env)));
  app.use('/api/v1/demo-cases', demoRoutes(env, options.storage || storageProvider(env)));
  app.use('/api/v1/mysteries/:id', investigationRoutes(options));
  app.use('/api/v1/mysteries/:id', resultsRoutes(options));
  if (env.NODE_ENV === 'production') {
  const clientDist = resolve(process.cwd(), 'client', 'dist');

  app.use(express.static(clientDist, { index: false }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }

    res.sendFile(resolve(clientDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

app.use((_req, _res, next) => next(missing()));
app.use(errorHandler);
  return app;
}
