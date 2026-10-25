import { classify, deadline, ProviderError, withRetry } from './retry.js';
import { validImage } from '../assets/image.js';

export class CloudflareImageProvider {
  constructor(env, { fetch: fetcher = globalThis.fetch } = {}) {
    this.env = env;
    this.fetch = fetcher;
  }

  async generate(prompt) {
    return withRetry(async () => {
      try {
        return await deadline(async (signal) => {
          // FLUX.1 schnell accepts at most 2,048 characters; never silently drop clue details.
          if (typeof prompt !== 'string' || !prompt.trim() || Array.from(prompt).length > 2048)
            throw new ProviderError('PROVIDER_REQUEST_REJECTED');
          const response = await this.fetch(
            `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${this.env.CLOUDFLARE_IMAGE_MODEL}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ prompt, steps: 4 }),
              signal,
              redirect: 'error',
            },
          );
          if (!response.ok) throw classify({ status: response.status });
          let payload;
          try {
            payload = await response.json();
          } catch {
            throw new ProviderError('IMAGE_FAILED');
          }
          const encoded = payload?.result?.image;
          if (
            payload?.success !== true ||
            typeof encoded !== 'string' ||
            encoded.length > 20 * 1024 * 1024 ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
          )
            throw new ProviderError('IMAGE_FAILED');
          const buffer = Buffer.from(encoded, 'base64');
          const mimeType = ['image/jpeg', 'image/png', 'image/webp'].find((type) =>
            validImage(buffer, type),
          );
          if (!mimeType) throw new ProviderError('IMAGE_FAILED');
          return { buffer, mimeType };
        }, this.env.IMAGE_TIMEOUT_MS);
      } catch (error) {
        throw classify(error);
      }
    });
  }
}
