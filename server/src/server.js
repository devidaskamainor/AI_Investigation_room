import { readEnv } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { logger } from './config/logger.js';
import { createApp } from './app.js';
import mongoose from 'mongoose';
import { ensureIndexes } from './models/index.js';
try {
  const env = readEnv();
  await connectDatabase(env.MONGODB_URI);
  await ensureIndexes();
  const server = createApp(env).listen(env.PORT, '127.0.0.1', () =>
    logger.info({ port: env.PORT }, 'API listening'),
  );
  const stop = () =>
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} catch (err) {
  logger.error({
    message: err.message.startsWith('Configuration error')
      ? err.message
      : 'Database connection failed. Check MONGODB_URI.',
  });
  process.exit(1);
}
