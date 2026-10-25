import { describe, expect, it } from 'vitest';
import { envSchema, readEnv } from './env.js';
import { testEnv } from '../../test/database.js';

const base = {
  ...Object.fromEntries(Object.entries(testEnv).map(([key, value]) => [key, String(value)])),
  MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
};
const cloudflare = {
  ...base,
  IMAGE_PROVIDER: 'cloudflare',
  CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
  CLOUDFLARE_API_TOKEN: 'test-cloudflare-token',
};

describe('image provider configuration', () => {
  it('keeps existing Gemini configuration valid without Cloudflare credentials', () => {
    expect(readEnv(base).IMAGE_PROVIDER).toBe('gemini');
  });
  it('requires both Cloudflare credentials when Cloudflare is selected', () => {
    const result = envSchema.safeParse({ ...base, IMAGE_PROVIDER: 'cloudflare' });
    expect(result.success).toBe(false);
    expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
    ]);
  });
  it('accepts an Account ID and token and defaults to the supported FLUX model', () => {
    expect(readEnv(cloudflare).CLOUDFLARE_IMAGE_MODEL).toBe('@cf/black-forest-labs/flux-1-schnell');
  });
  it.each(['person@example.test', 'replace-with-account-id', '../../other-account'])(
    'rejects an invalid account identifier: %s',
    (account) => {
      expect(envSchema.safeParse({ ...cloudflare, CLOUDFLARE_ACCOUNT_ID: account }).success).toBe(
        false,
      );
    },
  );
  it('does not disclose credentials in configuration errors', () => {
    expect(() =>
      readEnv({ ...cloudflare, CLOUDFLARE_ACCOUNT_ID: 'invalid-private-value' }),
    ).toThrow('Configuration error: CLOUDFLARE_ACCOUNT_ID:');
    try {
      readEnv({ ...cloudflare, CLOUDFLARE_ACCOUNT_ID: 'invalid-private-value' });
    } catch (error) {
      expect(error.message).not.toContain('invalid-private-value');
      expect(error.message).not.toContain(cloudflare.CLOUDFLARE_API_TOKEN);
    }
  });
});
