import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudflareImageProvider } from './cloudflare.provider.js';
import { GeminiImageProvider } from './gemini.provider.js';
import { imageProvider } from './image.provider.js';
import { TEST_PNG } from '../../../test/fixtures/assets.js';
import { testEnv } from '../../../test/database.js';

const env = {
  ...testEnv,
  IMAGE_PROVIDER: 'cloudflare',
  CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
  CLOUDFLARE_API_TOKEN: 'private-test-token',
  CLOUDFLARE_IMAGE_MODEL: '@cf/black-forest-labs/flux-1-schnell',
};
const success = () =>
  Response.json({ success: true, result: { image: TEST_PNG.toString('base64') } });

afterEach(() => vi.useRealTimers());

describe('Cloudflare image generation', () => {
  it('selects Cloudflare for images while retaining the Gemini image option', () => {
    expect(imageProvider(env)).toBeInstanceOf(CloudflareImageProvider);
    expect(imageProvider(testEnv)).toBeInstanceOf(GeminiImageProvider);
    expect(() => imageProvider({ ...env, IMAGE_PROVIDER: 'unknown' })).toThrow(
      'Configuration error',
    );
  });

  it('posts to the account-scoped endpoint and validates returned image bytes', async () => {
    const fetcher = vi.fn(async () => success());
    const provider = new CloudflareImageProvider(env, { fetch: fetcher });
    expect(await provider.generate('A fictional empty gallery.')).toEqual({
      buffer: TEST_PNG,
      mimeType: 'image/png',
    });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    );
    expect(options.headers.Authorization).toBe(`Bearer ${env.CLOUDFLARE_API_TOKEN}`);
    expect(options.redirect).toBe('error');
    expect(JSON.parse(options.body)).toEqual({ prompt: 'A fictional empty gallery.', steps: 4 });
  });

  it.each([
    { success: true, result: {} },
    { success: false, result: { image: TEST_PNG.toString('base64') } },
    { success: true, result: { image: '<script>not an image</script>' } },
    { success: true, result: { image: Buffer.from('<html>unsafe</html>').toString('base64') } },
  ])('rejects invalid image payloads without retrying: %j', async (payload) => {
    const fetcher = vi.fn(async () => Response.json(payload));
    await expect(
      new CloudflareImageProvider(env, { fetch: fetcher }).generate('Fictional image.'),
    ).rejects.toMatchObject({ code: 'IMAGE_FAILED' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed JSON', async () => {
    await expect(
      new CloudflareImageProvider(env, {
        fetch: async () => new Response('invalid json'),
      }).generate('Fictional image.'),
    ).rejects.toMatchObject({ code: 'IMAGE_FAILED' });
  });

  it.each([
    [400, 'PROVIDER_REQUEST_REJECTED'],
    [401, 'PROVIDER_AUTH_ERROR'],
    [403, 'PROVIDER_AUTH_ERROR'],
    [404, 'PROVIDER_MODEL_UNAVAILABLE'],
  ])('maps HTTP %i to a safe error without leaking response details', async (status, code) => {
    const fetcher = vi.fn(async () =>
      Response.json({ errors: [{ message: env.CLOUDFLARE_API_TOKEN }] }, { status }),
    );
    const error = await new CloudflareImageProvider(env, { fetch: fetcher })
      .generate('Fictional image.')
      .catch((error) => error);
    expect(error.code).toBe(code);
    expect(error.message).not.toContain(env.CLOUDFLARE_API_TOKEN);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503])('bounds retries for transient HTTP %i failures', async (status) => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => new Response(null, { status }));
    const result = new CloudflareImageProvider(env, { fetch: fetcher })
      .generate('Fictional image.')
      .catch((error) => error);
    await vi.runAllTimersAsync();
    expect((await result).code).toBe(status === 429 ? 'PROVIDER_RATE_LIMIT' : 'PROVIDER_ERROR');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('aborts stalled network calls and bounds retries', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_, { signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const result = new CloudflareImageProvider(env, { fetch: fetcher })
      .generate('Fictional image.')
      .catch((error) => error);
    await vi.runAllTimersAsync();
    expect((await result).code).toBe('PROVIDER_TIMEOUT');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('rejects overly long prompts without silently removing clue details', async () => {
    const fetcher = vi.fn();
    await expect(
      new CloudflareImageProvider(env, { fetch: fetcher }).generate('x'.repeat(2049)),
    ).rejects.toMatchObject({ code: 'PROVIDER_REQUEST_REJECTED' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
