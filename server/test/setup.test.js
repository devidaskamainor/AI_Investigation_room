import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'dotenv';
import { setupEnvironment } from '../../scripts/setup.mjs';

describe('Single-file environment setup', () => {
  let directory, target;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mystery-env-'));
    target = join(directory, '.env');
  });
  afterEach(async () => {
    await unlink(target).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    await rmdir(directory);
  });
  it('creates configuration and independent secrets without an example file', async () => {
    expect(await setupEnvironment(target)).toBe(true);
    const env = parse(await readFile(target));
    expect(env.SESSION_SECRET).toMatch(/^[a-f0-9]{96}$/);
    expect(env.PASSWORD_RESET_TOKEN_SECRET).toMatch(/^[a-f0-9]{96}$/);
    expect(env.SESSION_SECRET).not.toBe(env.PASSWORD_RESET_TOKEN_SECRET);
    expect(env.GEMINI_API_KEY).toBe('');
    expect(env.GEMINI_MODEL).toBe('gemini-3.5-flash-lite');
    expect(env.GEMINI_IMAGE_MODEL).toBe('gemini-3.1-flash-image');
    expect(env.CLOUDFLARE_ACCOUNT_ID).toBe('');
    expect(env.CLOUDFLARE_API_TOKEN).toBe('');
    expect(env.CLOUDFLARE_IMAGE_MODEL).toBe('@cf/black-forest-labs/flux-1-schnell');
    expect(env.MONGODB_URI).toBe('mongodb://127.0.0.1:27017/ai-mystery-room');
    expect(env.VITE_API_URL).toBe('/api/v1');
  });
  it('preserves existing configuration byte for byte', async () => {
    const original = 'GEMINI_API_KEY=test-only-value\r\nPORT=5050\r\n';
    await writeFile(target, original);
    expect(await setupEnvironment(target)).toBe(false);
    expect(await readFile(target, 'utf8')).toBe(original);
  });
});
