import fs from 'node:fs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
export async function testDatabase() {
  const systemBinary =
    process.env.MONGOMS_SYSTEM_BINARY ||
    (process.platform === 'win32' &&
    fs.existsSync('C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe')
      ? 'C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe'
      : undefined);
  const db = await MongoMemoryServer.create({
    binary: systemBinary ? { systemBinary, checkMD5: false } : undefined,
  });
  await mongoose.connect(db.getUri());
  return {
    uri: db.getUri(),
    async close() {
      await mongoose.disconnect();
      await db.stop();
    },
  };
}
export const testEnv = {
  NODE_ENV: 'test',
  PORT: 5000,
  CLIENT_URL: 'http://localhost:5173',
  MONGODB_URI: '',
  SESSION_SECRET: 's'.repeat(40),
  PASSWORD_RESET_TOKEN_SECRET: 'r'.repeat(40),
  COOKIE_DOMAIN: '',
  GEMINI_API_KEY: 'test-only-key',
  GEMINI_MODEL: 'mock',
  GEMINI_IMAGE_MODEL: 'mock-image',
  GEMINI_TIMEOUT_MS: 500,
  GEMINI_MAX_RETRIES: 3,
  REPAIR_MAX_CYCLES: 2,
  SOLVER_CHECK_ENABLED: true,
  IMAGE_PROVIDER: 'gemini',
  IMAGE_CONCURRENCY: 3,
  IMAGE_TIMEOUT_MS: 500,
  ASSET_STORAGE_PROVIDER: 'local',
  ASSET_STORAGE_DIR: '.runtime/test-assets',
  ASSET_STORAGE_BUCKET: '',
  DAILY_GENERATION_LIMIT: 5,
  DEMO_MODE: false,
};
