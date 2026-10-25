import 'dotenv/config';
import { z } from 'zod';
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const positive = (value) => z.coerce.number().int().positive().default(value);
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: positive(5000),
    CLIENT_URL: z.string().url().default('http://localhost:5173'),
    MONGODB_URI: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    PASSWORD_RESET_TOKEN_SECRET: z.string().min(32),
    COOKIE_DOMAIN: z.string().default(''),
    GEMINI_API_KEY: z.string().min(1),
    GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
    GEMINI_TIMEOUT_MS: positive(60000),
    GEMINI_MAX_RETRIES: positive(3),
    REPAIR_MAX_CYCLES: z.coerce.number().int().min(0).max(3).default(2),
    SOLVER_CHECK_ENABLED: bool.default('true'),
    IMAGE_PROVIDER: z.enum(['gemini', 'cloudflare']).default('gemini'),
    GEMINI_IMAGE_MODEL: z.string().default('gemini-3.1-flash-image'),
    CLOUDFLARE_ACCOUNT_ID: z.string().trim().default(''),
    CLOUDFLARE_API_TOKEN: z.string().trim().default(''),
    CLOUDFLARE_IMAGE_MODEL: z
      .literal('@cf/black-forest-labs/flux-1-schnell')
      .default('@cf/black-forest-labs/flux-1-schnell'),
    IMAGE_CONCURRENCY: positive(3),
    IMAGE_TIMEOUT_MS: positive(90000),
    ASSET_STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    ASSET_STORAGE_DIR: z.string().default('./storage'),
    ASSET_STORAGE_BUCKET: z.string().default(''),
    ASSET_STORAGE_ACCESS_KEY: z.string().default(''),
    ASSET_STORAGE_SECRET_KEY: z.string().default(''),
    ASSET_STORAGE_REGION: z.string().default('us-east-1'),
    ASSET_STORAGE_ENDPOINT: z.string().default(''),
    DAILY_GENERATION_LIMIT: positive(5),
    DEMO_MODE: bool.default('false'),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === 'production' && v.DEMO_MODE)
      ctx.addIssue({
        code: 'custom',
        path: ['DEMO_MODE'],
        message: 'Demo mode is forbidden in production',
      });
    if (v.NODE_ENV === 'production' && v.CLIENT_URL.startsWith('http:'))
      ctx.addIssue({ code: 'custom', path: ['CLIENT_URL'], message: 'Production requires HTTPS' });
    if (v.IMAGE_PROVIDER === 'cloudflare') {
      if (!/^[a-f0-9]{32}$/i.test(v.CLOUDFLARE_ACCOUNT_ID))
        ctx.addIssue({
          code: 'custom',
          path: ['CLOUDFLARE_ACCOUNT_ID'],
          message: 'Set the 32-character Account ID from Workers AI (not an email address)',
        });
      if (!v.CLOUDFLARE_API_TOKEN || v.CLOUDFLARE_API_TOKEN.startsWith('replace-with'))
        ctx.addIssue({
          code: 'custom',
          path: ['CLOUDFLARE_API_TOKEN'],
          message: 'Set your Workers AI API token',
        });
    }
    if (v.ASSET_STORAGE_PROVIDER === 's3')
      for (const k of [
        'ASSET_STORAGE_BUCKET',
        'ASSET_STORAGE_ACCESS_KEY',
        'ASSET_STORAGE_SECRET_KEY',
      ])
        if (!v[k]) ctx.addIssue({ code: 'custom', path: [k], message: 'Required for S3 storage' });
    for (const k of ['SESSION_SECRET', 'PASSWORD_RESET_TOKEN_SECRET', 'GEMINI_API_KEY'])
      if (v[k].startsWith('replace-with'))
        ctx.addIssue({ code: 'custom', path: [k], message: 'Replace the example placeholder' });
  });
export function readEnv(source = process.env) {
  const result = envSchema.safeParse(source);
  if (!result.success)
    throw new Error(
      `Configuration error: ${result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
    );
  return result.data;
}
export function readDatabaseEnv(source = process.env) {
  const result = z.object({ MONGODB_URI: z.string().min(1) }).safeParse(source);
  if (!result.success) throw new Error('Configuration error: MONGODB_URI is required.');
  return result.data;
}
